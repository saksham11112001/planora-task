import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { resolvePackEntitlement }   from '@/lib/msme/packs'
import {
  currentPeriod, isValidPeriodEnd, describePeriod, periodsForFinancialYear,
  previousPeriod, nextPeriod,
} from '@/lib/msme/periods'
import { msmeToday }            from '@/lib/msme/today'
import { DECLARATION_COLS }         from '@/lib/msme/declarations'
import type { Declaration }         from '@/lib/msme/declarations'
import { chunk, fetchAllRows }      from '@/lib/supabase/fetchAll'

/** The vendor-master columns the list reads. Declared because the paged read
 *  cannot infer them, and because the period overlay below depends on knowing
 *  which of these the declaration replaces. */
interface VendorRow {
  id: string
  vendor_name: string
  vendor_email: string
  gstin: string | null
  pan: string | null
  client_id: string | null
  status: string
  payment_status: string
  udyam_number: string | null
  udyam_registered_on: string | null
  msme_category: string | null
  nature_of_business: string | null
  outstanding_amount: number | null
  cert_url: string | null
  is_not_msme: boolean
  declarant_name: string | null
  declared_at: string | null
  submitted_at: string | null
  email_count: number
  last_emailed_at: string | null
  is_paid: boolean
  created_at: string
  email_bounced: boolean | null
  bounce_reason: string | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()

  // Which half-year the list shows. Form MSME-1 is filed twice a year, so the
  // same vendor has a separate status, balance and chase count per cycle.
  const rawPeriod = req.nextUrl.searchParams.get('period_end')
  const periodEnd = isValidPeriodEnd(rawPeriod)
    ? rawPeriod
    : currentPeriod(msmeToday()).periodEnd
  const period = describePeriod(periodEnd)

  // Which client company's suppliers to list. MSME-1 is filed BY a company
  // about its own suppliers, so a firm serving many companies works one at a
  // time.
  //   absent / 'all' — every vendor in the firm (what the page did before)
  //   'none'         — only vendors not yet assigned to a client
  //   a uuid         — that client's vendors
  const rawClient = req.nextUrl.searchParams.get('client_id')
  // Shape-checked before it reaches the query. Postgres rejects a malformed
  // uuid with an error, which this route would return as a 500 — a bad query
  // string should narrow to nothing or fall back, not look like an outage.
  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  const clientFilter =
    !rawClient || rawClient === 'all' ? 'all'
    : rawClient === 'none'            ? 'none'
    : isUuid(rawClient)               ? rawClient
    : 'all'

  // Paged. An org may hold up to 2000 vendors (the import cap) while PostgREST
  // truncates at 1000 silently, so the list would simply stop — and the
  // per-client counts below ARE paged, so the selector would say "Alpha
  // (1,500)" above a list showing a thousand.
  //
  // Ordered by created_at then id: created_at alone is not unique, so paging
  // could repeat one row and drop another.
  const vendorsPaged = fetchAllRows<VendorRow>((from, to) => {
    let q = admin
      .from('msme_vendors')
      .select('id, vendor_name, vendor_email, gstin, pan, client_id, status, payment_status, udyam_number, udyam_registered_on, msme_category, nature_of_business, outstanding_amount, cert_url, is_not_msme, declarant_name, declared_at, submitted_at, email_count, last_emailed_at, is_paid, created_at, email_bounced, bounce_reason')
      .eq('org_id', mb.org_id)
      .eq('is_deleted', false)
    if (clientFilter === 'none')      q = q.is('client_id', null)
    else if (clientFilter !== 'all')  q = q.eq('client_id', clientFilter)
    return q
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
  })

  const [
    { data: vendors, error },
    { data: packRow },
    { data: addonRow },
    { count: totalEver },
  ] = await Promise.all([
    vendorsPaged,
    admin
      .from('org_feature_settings')
      .select('config')
      .eq('org_id', mb.org_id)
      .eq('feature_key', 'msme_pack')
      .maybeSingle(),
    admin
      .from('org_feature_settings')
      .select('config')
      .eq('org_id', mb.org_id)
      .eq('feature_key', 'msme_addon_slots')
      .maybeSingle(),
    // Count vendors that have ever been emailed (including soft-deleted ones) — these are permanent slots used.
    // Deliberately NOT narrowed by the client filter: slots are a firm-level
    // entitlement, so the usage figure must stay the same whichever client is
    // on screen. Scoping it would show a firm with its pack nearly full as
    // having plenty of room while viewing one client.
    admin
      .from('msme_vendors')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', mb.org_id)
      .gt('email_count', 0),
  ])

  if (error) {
    // fetchAllRows widens the error to unknown, so it is narrowed rather than
    // assumed to carry a message.
    return NextResponse.json(
      { error: (error as { message?: string }).message ?? 'Failed to load vendors' },
      { status: 500 },
    )
  }

  // This period's declarations, keyed by vendor. Read separately rather than
  // as an embedded join so a vendor with no declaration for the period still
  // appears in the list — as 'pending', which is exactly what they are.
  const declByVendor = new Map<string, Declaration>()
  for (const part of chunk((vendors ?? []).map(v => v.id))) {
    const { data: decls } = await admin
      .from('msme_declarations')
      .select(DECLARATION_COLS)
      .eq('org_id', mb.org_id)
      .eq('period_end', periodEnd)
      .in('vendor_id', part)
    for (const d of (decls as Declaration[] | null) ?? []) declByVendor.set(d.vendor_id, d)
  }

  // Overlay the period's declaration over the vendor master.
  //
  // The declaration fields win, so every existing consumer of this list reads
  // the SELECTED half-year without changing how it reads it. The vendor row's
  // own copy is a mirror of the latest declaration and would show March's
  // figures while the user is looking at September.
  const shaped = (vendors ?? []).map(v => {
    const d = declByVendor.get(v.id)
    return {
      ...v,
      // ── period-scoped ──
      status:              d?.status              ?? 'pending',
      is_not_msme:         d?.is_not_msme         ?? false,
      udyam_number:        d?.udyam_number        ?? null,
      pan:                 d?.pan                 ?? v.pan ?? null,
      udyam_registered_on: d?.udyam_registered_on ?? null,
      msme_category:       d?.msme_category       ?? null,
      nature_of_business:  d?.nature_of_business  ?? null,
      outstanding_amount:  d?.outstanding_amount  ?? null,
      cert_url:            d?.cert_url            ?? null,
      declarant_name:      d?.declarant_name      ?? null,
      declared_at:         d?.declared_at         ?? null,
      submitted_at:        d?.submitted_at        ?? null,
      // Chases sent for THIS half-year — what "3/5 sent" should mean.
      email_count:         d?.email_count         ?? 0,
      last_emailed_at:     d?.last_emailed_at     ?? null,

      // ── lifetime, from the vendor master ──
      // The billing slot ledger. Kept under its own name because the UI needs
      // both: "has this vendor ever consumed a slot" (lifetime) is a different
      // question from "how many times have we chased them this cycle".
      lifetime_email_count: v.email_count,
      declaration_id:       d?.id ?? null,
      period_end:           periodEnd,
    }
  })

  // The firm's clients, so the page can offer the selector without a second
  // round trip. Archived clients are excluded, matching /api/clients.
  // Paged: a large firm can have more clients than PostgREST's 1000-row cap,
  // and a client missing from the selector is a client whose return cannot be
  // produced. `is_archived` is matched with .neq the same way /api/clients
  // does, so the two lists always agree about which clients exist.
  const { data: clientRows } = await fetchAllRows<{ id: string; name: string }>(
    (from, to) => admin
      .from('clients')
      .select('id, name')
      .eq('org_id', mb.org_id)
      .neq('is_archived', true)
      .order('name', { ascending: true })
      .order('id', { ascending: true })   // name is not unique
      .range(from, to),
  )

  // How many vendors sit under each client, for the selector's counts. Read
  // unfiltered so the numbers do not shift as the user switches between
  // clients.
  //
  // Paged: an org may hold up to 2000 vendors (the import cap) and PostgREST
  // silently truncates at 1000, so a single read would undercount every
  // client's total for the largest firms — and quietly, which is the worst
  // way to be wrong about a number on screen.
  const { data: allForCounts } = await fetchAllRows<{ client_id: string | null }>(
    (from, to) => admin
      .from('msme_vendors')
      .select('client_id')
      .eq('org_id', mb.org_id)
      .eq('is_deleted', false)
      .order('id', { ascending: true })   // unique, so pages cannot overlap
      .range(from, to),
  )
  const vendorCountByClient: Record<string, number> = {}
  for (const row of allForCounts) {
    const key = row.client_id ?? 'none'
    vendorCountByClient[key] = (vendorCountByClient[key] ?? 0) + 1
  }

  // Packs run for a year. resolvePackEntitlement is the single place that
  // decides what the term means, so the list, the send gates and settings can
  // never disagree about whether an org still has its slots.
  const addonSlots: number = (addonRow?.config as any)?.extra_slots ?? 0
  const ent = resolvePackEntitlement(packRow?.config as any, addonSlots)
  const total = shaped.length
  return NextResponse.json({
    vendors: shaped, total, totalEver: totalEver ?? 0,
    vendorLimit: ent.vendorLimit,
    // Surfaced so the dashboard can show renewal state rather than silently
    // showing fewer slots than the customer thinks they bought.
    packExpiresAt: ent.expiresAt,
    packExpired:   ent.isExpired,

    // The selected cycle, and both cycles of its financial year so the UI can
    // offer them without re-deriving the statutory calendar. The adjacent
    // periods are named here for the same reason: the half-year arithmetic
    // lives in lib/msme/periods.ts only, so the UI cannot disagree with it.
    period: {
      period_end: period.periodEnd, label: period.label, short_label: period.shortLabel,
      as_on: period.asOn, range_label: period.rangeLabel,
      due_date: period.dueDate, financial_year: period.financialYear, half: period.half,
      prev_period_end: previousPeriod(period.periodEnd).periodEnd,
      next_period_end: nextPeriod(period.periodEnd).periodEnd,
      // Is this the cycle a firm is currently collecting for?
      is_current: period.periodEnd === currentPeriod(msmeToday()).periodEnd,
    },
    periods: periodsForFinancialYear(period.financialYear).map(p => ({
      period_end: p.periodEnd, label: p.label, short_label: p.shortLabel,
      as_on: p.asOn, range_label: p.rangeLabel, due_date: p.dueDate, half: p.half,
    })),

    // Per-client scoping. client_id is the filter in force, echoed back so the
    // UI never disagrees with what it is showing.
    client_id: clientFilter,
    clients:   clientRows ?? [],
    vendorCountByClient,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only managers and above can add vendors' }, { status: 403 })
  }

  const body = await req.json()
  const { vendor_name, vendor_email, gstin, client_id: rawClientId } = body

  if (!vendor_name?.trim() || !vendor_email?.trim()) {
    return NextResponse.json({ error: 'vendor_name and vendor_email are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor_email)) {
    return NextResponse.json({ error: 'Invalid vendor email address' }, { status: 400 })
  }

  const admin       = createAdminClient()
  const emailNorm   = vendor_email.trim().toLowerCase()

  // Which client company this supplier belongs to. Null means firm level,
  // which is what every vendor was before per-client scoping.
  const clientId: string | null =
    typeof rawClientId === 'string' && rawClientId && rawClientId !== 'all' && rawClientId !== 'none'
      ? rawClientId
      : null

  // Verify the client belongs to THIS org before storing it. Without this a
  // member could attach a vendor to another firm's client id and have its name
  // rendered back to them — the id comes straight from the request body.
  if (clientId) {
    const { data: client } = await admin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('org_id', mb.org_id)
      .maybeSingle()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 400 })
  }

  // Fetch EVERY row for this email in one query — active and soft-deleted.
  //
  // This used to be two .maybeSingle() lookups whose errors were discarded.
  // maybeSingle() ERRORS when more than one row matches, and an org can hold
  // several soft-deleted rows for the same address (the unique index is
  // partial: `WHERE is_deleted = false`, so it constrains active rows only).
  // When that happened both lookups returned null, the reactivate branch was
  // skipped, and the request fell through to an insert — which is how an email
  // ends up looking permanently taken after a delete.
  //
  // Scoped to the client as well, matching the unique index. The same supplier
  // commonly supplies several of a firm's client companies, and each of those
  // needs its own declaration — so "already exists" must mean "already exists
  // FOR THIS CLIENT", not anywhere in the firm.
  let lookup = admin
    .from('msme_vendors')
    .select('id, is_deleted, created_at')
    .eq('org_id', mb.org_id)
    .eq('vendor_email', emailNorm)
  lookup = clientId ? lookup.eq('client_id', clientId) : lookup.is('client_id', null)

  const { data: sameEmail, error: lookupErr } = await lookup
    .order('created_at', { ascending: false })

  // Never guess on a failed lookup: inserting here could breach the unique
  // index or silently duplicate a vendor.
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 })

  const activeRow  = (sameEmail ?? []).find(v => !v.is_deleted)
  const deletedRow = (sameEmail ?? []).find(v =>  v.is_deleted)

  if (activeRow) {
    return NextResponse.json({
      error: clientId
        ? 'This vendor is already on this client\'s list'
        : 'A vendor with this email already exists',
    }, { status: 409 })
  }

  if (deletedRow) {
    const deleted = deletedRow
    // Reactivate the existing slot — no new slot consumed
    const { data: vendor, error } = await admin
      .from('msme_vendors')
      .update({
        vendor_name:    vendor_name.trim(),
        gstin:          gstin?.trim() || null,
        is_deleted:     false,
        status:         'pending',
        // email_count and last_emailed_at are deliberately NOT reset.
        //
        // They are the slot ledger, not display state: every gate counts rows
        // where email_count > 0, across deleted rows too, so that a slot stays
        // consumed once an email has gone out. Zeroing it here handed the slot
        // back and made the whole permanence scheme defeatable in three clicks
        // — email 25 vendors, delete them, re-add the same 25, and the counter
        // reads zero again while the declarations already collected stay in the
        // table. Repeat, and a 25-vendor pack tracks any number of vendors.
        //
        // Re-adding reuses the existing slot, which is what the anti-gaming
        // migration intended; it was never meant to release it.
      })
      .eq('id', deleted.id)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ vendor }, { status: 201 })
  }

  const { data: vendor, error } = await admin
    .from('msme_vendors')
    .insert({
      org_id:         mb.org_id,
      client_id:      clientId,
      vendor_name:    vendor_name.trim(),
      vendor_email:   emailNorm,
      gstin:          gstin?.trim() || null,
      is_paid:        true,
      payment_status: 'free',
      created_by:     user.id,
    })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendor }, { status: 201 })
}
