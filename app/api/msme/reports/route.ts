// The three MSME outputs a firm is actually paid to produce, plus the Udyam
// re-verification list. One route rather than four, because they share the
// same auth, the same org scoping and the same underlying read — and because
// four copies of that boilerplate is four places for it to drift.
//
//   ?type=exposure  — section 43B(h) disallowance and MSMED interest
//   ?type=form1     — the Form MSME-1 filing schedule
//   ?type=compare   — this half-year against the previous one
//   ?type=udyam     — certificates due for re-verification
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser }              from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import {
  currentPeriod, isValidPeriodEnd, describePeriod, previousPeriod,
} from '@/lib/msme/periods'
import { msmeToday }            from '@/lib/msme/today'
import { assessExposure, outstandingAsOn, dueFromDate } from '@/lib/msme/section43b'
import type { InvoiceInput, VendorInput, Category, Nature } from '@/lib/msme/section43b'
import { buildForm1 }     from '@/lib/msme/form1'
import type { Form1Input } from '@/lib/msme/form1'
import { comparePeriods } from '@/lib/msme/periodCompare'
import type { CompareInput, PeriodSide } from '@/lib/msme/periodCompare'
import { assessBook }     from '@/lib/msme/udyamWatch'
import { fetchAllRows, chunk } from '@/lib/supabase/fetchAll'

/**
 * Fallback RBI bank rate, as a percent.
 *
 * Section 16 MSMED interest is three times this. It is stored per org under
 * the `msme_bank_rate` feature key so a firm can set the rate in force for the
 * year it is computing; this constant is only the starting value, and the
 * response always states which rate was used so a figure can never be filed
 * without the reader knowing.
 */
const DEFAULT_BANK_RATE = 6.5

const isUuid = (s: unknown) =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const sp   = req.nextUrl.searchParams
  const type = sp.get('type') ?? 'exposure'
  if (!['exposure', 'form1', 'compare', 'udyam'].includes(type)) {
    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  }

  const rawPeriod = sp.get('period_end')
  const periodEnd = isValidPeriodEnd(rawPeriod)
    ? rawPeriod
    : currentPeriod(msmeToday()).periodEnd
  const period = describePeriod(periodEnd)

  const rawClient = sp.get('client_id')
  const clientId  = isUuid(rawClient) ? rawClient : null
  const firmLevelOnly = rawClient === 'none'

  const admin = createAdminClient()

  // ── Vendors in scope ────────────────────────────────────────────────────
  //
  // Paged. An org may hold up to 2000 vendors (the import cap) and PostgREST
  // truncates at 1000 without saying so. A short read here does not just
  // shorten a list — it understates a section 43B(h) disallowance and drops
  // suppliers out of a statutory return, silently.
  const { data: vendors, error: vendorErr } = await fetchAllRows<{
    id: string; vendor_name: string; client_id: string | null
    pan: string | null; gstin: string | null
  }>((from, to) => {
    let q = admin
      .from('msme_vendors')
      .select('id, vendor_name, client_id, pan, gstin')
      .eq('org_id', mb.org_id)
      .eq('is_deleted', false)
    if (clientId)           q = q.eq('client_id', clientId)
    else if (firmLevelOnly) q = q.is('client_id', null)
    return q.order('id', { ascending: true }).range(from, to)
  })
  if (vendorErr) {
    return NextResponse.json(
      { error: (vendorErr as { message?: string }).message ?? 'Failed to load vendors' },
      { status: 500 },
    )
  }

  const vendorIds = (vendors ?? []).map(v => v.id)
  if (vendorIds.length === 0) {
    return NextResponse.json({ type, period: periodMeta(period), empty: true })
  }

  // ── This period's declarations ──────────────────────────────────────────
  const decls = await readDeclarations(admin, mb.org_id, vendorIds, periodEnd)

  // ── Udyam watch needs nothing else ──────────────────────────────────────
  if (type === 'udyam') {
    const today = msmeToday()
    const book = assessBook((vendors ?? []).map(v => {
      const d = decls.get(v.id)
      return {
        vendorName: v.vendor_name,
        category: (d?.msme_category ?? null) as 'micro' | 'small' | 'medium' | null,
        isNotMsme: !!d?.is_not_msme,
        udyamRegisteredOn: d?.udyam_registered_on ?? null,
        today,
      }
    }))
    return NextResponse.json({ type, period: periodMeta(period), ...book })
  }

  // ── Period comparison needs the previous half-year ──────────────────────
  if (type === 'compare') {
    const prevEnd   = previousPeriod(periodEnd).periodEnd
    const prevDecls = await readDeclarations(admin, mb.org_id, vendorIds, prevEnd)

    const side = (d: DeclRow | undefined): PeriodSide => ({
      status:            (d?.status ?? 'none') as PeriodSide['status'],
      isNotMsme:         !!d?.is_not_msme,
      category:          (d?.msme_category ?? null) as PeriodSide['category'],
      outstandingAmount: d?.outstanding_amount ?? null,
    })

    const input: CompareInput[] = (vendors ?? []).map(v => ({
      vendorId: v.id, vendorName: v.vendor_name,
      current:  side(decls.get(v.id)),
      previous: prevDecls.has(v.id) ? side(prevDecls.get(v.id)) : null,
    }))

    return NextResponse.json({
      type, period: periodMeta(period),
      previousPeriod: periodMeta(describePeriod(prevEnd)),
      ...comparePeriods(input),
    })
  }

  // ── Exposure and Form MSME-1 both need the invoice ledger ───────────────
  //
  // Read in full, not capped: an understated ledger produces an understated
  // disallowance, which is the one error that matters most here.
  const invoicesByVendor = new Map<string, InvoiceInput[]>()
  for (const part of chunk(vendorIds)) {
    const { data } = await fetchAllRows<{
      vendor_id: string; invoice_no: string | null; invoice_date: string
      amount: number; paid_amount: number; payment_date: string | null
      agreement_days: number | null
    }>((from, to) => admin
      .from('msme_invoices')
      .select('vendor_id, invoice_no, invoice_date, amount, paid_amount, payment_date, agreement_days')
      .eq('org_id', mb.org_id)
      .in('vendor_id', part)
      .order('invoice_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
      { maxRows: 50_000 },
    )
    for (const row of data) {
      const list = invoicesByVendor.get(row.vendor_id) ?? []
      list.push({
        invoiceNo: row.invoice_no, invoiceDate: row.invoice_date,
        amount: Number(row.amount), paidAmount: Number(row.paid_amount),
        paymentDate: row.payment_date, agreementDays: row.agreement_days,
      })
      invoicesByVendor.set(row.vendor_id, list)
    }
  }

  if (type === 'form1') {
    const input: Form1Input[] = (vendors ?? []).map(v => {
      const d   = decls.get(v.id)
      const inv = invoicesByVendor.get(v.id) ?? []
      // Where a ledger exists it is the better answer, because it is the
      // BUYER's own books and it knows the dates. The vendor's declared figure
      // is the fallback.
      const ledgerBalance = inv.length ? outstandingAsOn(inv, periodEnd) : null
      return {
        vendorId:    v.id,
        vendorName:  v.vendor_name,
        pan:         d?.pan ?? v.pan ?? null,
        category:    (d?.msme_category ?? null) as Form1Input['category'],
        isNotMsme:   !!d?.is_not_msme,
        status:      (d?.status ?? 'pending') as Form1Input['status'],
        outstanding: ledgerBalance ?? d?.outstanding_amount ?? null,
        // Derived from the oldest unsettled invoice; the stored column is the
        // fallback for a firm with no ledger imported.
        dueFromDate: (inv.length ? dueFromDate(inv, periodEnd) : null) ?? d?.due_from_date ?? null,
        delayReason: d?.delay_reason ?? null,
      }
    })

    const schedule = buildForm1(input)
    return NextResponse.json({
      type, period: periodMeta(period), ...schedule,
      // Says which figures came from the ledger, so a reviewer knows whether
      // the return rests on the buyer's books or the vendor's word.
      ledgerVendorCount: [...invoicesByVendor.keys()].length,
    })
  }

  // ── Exposure ────────────────────────────────────────────────────────────
  const { data: rateRow } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_bank_rate')
    .maybeSingle()
  const configured = Number((rateRow?.config as { rate?: number } | null)?.rate)
  const bankRate   = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_BANK_RATE

  // Assessed as at TODAY, not at the period end: interest on a still-unpaid
  // invoice is still accruing, and a report dated to a past period end would
  // understate a live liability.
  const asOn = msmeToday()

  const input: VendorInput[] = (vendors ?? []).map(v => {
    const d = decls.get(v.id)
    return {
      vendorId:   v.id,
      vendorName: v.vendor_name,
      category:   (d?.msme_category ?? null) as Category,
      nature:     (d?.nature_of_business ?? null) as Nature,
      isNotMsme:  !!d?.is_not_msme,
      invoices:   invoicesByVendor.get(v.id) ?? [],
    }
  }).filter(v => v.invoices.length > 0)

  return NextResponse.json({
    type, period: periodMeta(period),
    asOn, bankRate,
    bankRateIsDefault: !(Number.isFinite(configured) && configured > 0),
    // Exposure is computed per invoice, so a vendor with no ledger cannot be
    // assessed at all. Stated plainly rather than counted as zero risk.
    vendorsWithoutLedger: (vendors ?? []).length - input.length,
    ...assessExposure(input, asOn, bankRate),
  })
}

interface DeclRow {
  vendor_id: string; status: string; is_not_msme: boolean
  msme_category: string | null; nature_of_business: string | null
  outstanding_amount: number | null; pan: string | null
  udyam_registered_on: string | null
  due_from_date: string | null; delay_reason: string | null
}

async function readDeclarations(
  admin: { from: (t: string) => any },
  orgId: string,
  vendorIds: string[],
  periodEnd: string,
): Promise<Map<string, DeclRow>> {
  const out = new Map<string, DeclRow>()
  // Chunked so a few hundred vendor ids cannot build a query string long
  // enough to come back 414 — which reads as "no rows" to code that only
  // checks `data`. Each chunk returns at most one row per vendor, so it stays
  // well inside the 1000-row cap.
  for (const part of chunk(vendorIds)) {
    const { data } = await admin
      .from('msme_declarations')
      .select('vendor_id, status, is_not_msme, msme_category, nature_of_business, outstanding_amount, pan, udyam_registered_on, due_from_date, delay_reason')
      // org_id as well as the vendor ids. The ids are already org-scoped, so
      // this is belt-and-braces — but CLAUDE.md requires every query to filter
      // by org_id, and a filter that is merely implied by an earlier query is
      // the kind that survives a refactor the implication does not.
      .eq('org_id', orgId)
      .eq('period_end', periodEnd)
      .in('vendor_id', part)
    for (const d of (data as DeclRow[] | null) ?? []) out.set(d.vendor_id, d)
  }
  return out
}

function periodMeta(p: ReturnType<typeof describePeriod>) {
  return {
    period_end: p.periodEnd, label: p.label, short_label: p.shortLabel,
    as_on: p.asOn, range_label: p.rangeLabel, due_date: p.dueDate,
    financial_year: p.financialYear, half: p.half,
  }
}
