// Bill-wise outstanding for MSME vendors.
//
// GET  — a vendor's invoices, or the whole org's.
// POST — import matched ledger rows. The CLIENT parses the spreadsheet and
//        sends plain rows; matching party names to vendors happens here,
//        because it needs the vendor list and must not be something a browser
//        can influence.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser }              from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { matchLedger, SKIP_REASON_TEXT } from '@/lib/msme/ledgerImport'
import type { LedgerRow }           from '@/lib/msme/ledgerImport'
import { fetchAllRows, chunk }      from '@/lib/supabase/fetchAll'

const INVOICE_COLS =
  'id, vendor_id, invoice_no, invoice_date, amount, paid_amount, payment_date, agreement_days, source, created_at'

/** One import call covers one upload; beyond this the browser should batch,
 *  as the vendor import already does. */
const MAX_ROWS = 1000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin    = createAdminClient()
  const vendorId = req.nextUrl.searchParams.get('vendor_id')

  // Paged: PostgREST truncates at 1000 rows without saying so, and an invoice
  // ledger is the one table here that will routinely exceed it.
  const { data: invoices, error, truncated } = await fetchAllRows<Record<string, unknown>>(
    (from, to) => {
      let q = admin.from('msme_invoices').select(INVOICE_COLS).eq('org_id', mb.org_id)
      if (vendorId) q = q.eq('vendor_id', vendorId)
      return q.order('invoice_date', { ascending: true }).order('id', { ascending: true }).range(from, to)
    },
    // A year of bill-wise data for a few hundred vendors runs well past the
    // default ceiling, and a silently short ledger would understate exposure.
    { maxRows: 50_000 },
  )

  if (error) {
    return NextResponse.json(
      { error: (error as { message?: string }).message ?? 'Failed to load invoices' },
      { status: 500 },
    )
  }
  return NextResponse.json({ invoices, truncated })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only managers and above can import a ledger' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const rows: LedgerRow[] = Array.isArray(body?.rows) ? body.rows : []
  const rawClientId: unknown = body?.client_id

  if (rows.length === 0) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Match only against the client's own vendors when a client is selected.
  // Matching across the whole firm would attach one company's ledger balance
  // to a vendor row belonging to another company's filing.
  const isUuid = (s: unknown) =>
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  const clientId = isUuid(rawClientId) ? rawClientId as string : null

  // Paged: matching against a truncated vendor list would report "no tracked
  // vendor matches this party" for every supplier past the 1000th, which reads
  // as a data problem at the firm's end rather than ours.
  const { data: vendors, error: vendorErr } = await fetchAllRows<{
    id: string; vendor_name: string; gstin: string | null
  }>((from, to) => {
    let q = admin
      .from('msme_vendors')
      .select('id, vendor_name, gstin')
      .eq('org_id', mb.org_id)
      .eq('is_deleted', false)
    if (clientId) q = q.eq('client_id', clientId)
    return q.order('id', { ascending: true }).range(from, to)
  })
  if (vendorErr) {
    return NextResponse.json(
      { error: (vendorErr as { message?: string }).message ?? 'Failed to load vendors' },
      { status: 500 },
    )
  }

  const result = matchLedger(
    rows,
    (vendors ?? []).map(v => ({ id: v.id, vendorName: v.vendor_name, gstin: v.gstin })),
  )

  // Nothing matched: report why rather than writing an empty import.
  if (result.matched.length === 0) {
    return NextResponse.json({
      imported: 0, updated: 0,
      skipped: result.skipped.map(s => ({ ...s, reason_text: SKIP_REASON_TEXT[s.reason] })),
    })
  }

  // Upsert on (vendor_id, invoice_no) so re-importing a ledger updates rows
  // instead of duplicating them — a firm re-exporting Tally after recording
  // payments is the normal case, not an error.
  //
  // One path covers both numbered and un-numbered rows. Postgres treats NULLs
  // as distinct in a unique index, so an invoice with no number never
  // conflicts and simply inserts. The consequence is that un-numbered rows
  // cannot be de-duplicated across imports, which is inherent: without a
  // number there is no key to match them on.
  const toRow = (m: typeof result.matched[number]) => ({
    org_id: mb.org_id, vendor_id: m.vendorId,
    invoice_no: m.invoiceNo, invoice_date: m.invoiceDate,
    amount: m.amount, paid_amount: m.paidAmount,
    payment_date: m.paymentDate, agreement_days: m.agreementDays,
    source: 'ledger_import' as const,
    updated_at: new Date().toISOString(),
  })

  let written = 0
  const failures: string[] = []

  for (const part of chunk(result.matched, 500)) {
    const { error } = await admin
      .from('msme_invoices')
      .upsert(part.map(toRow), { onConflict: 'vendor_id,invoice_no' })
    if (error) failures.push(error.message)
    else written += part.length
  }

  if (failures.length > 0 && written === 0) {
    return NextResponse.json({ error: `Import failed: ${failures[0]}` }, { status: 500 })
  }

  return NextResponse.json({
    imported: written,
    matchedByGstin: result.matched.filter(m => m.matchedBy === 'gstin').length,
    matchedByName:  result.matched.filter(m => m.matchedBy === 'name').length,
    // Every unmatched row with its reason. A financial import that drops rows
    // silently is how a balance goes missing from a return.
    skipped: result.skipped.map(s => ({ ...s, reason_text: SKIP_REASON_TEXT[s.reason] })),
    // Surfaced rather than swallowed: a partial write must be visible.
    partialFailures: failures,
  })
}
