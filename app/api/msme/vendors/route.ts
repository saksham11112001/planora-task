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
import { DECLARATION_COLS }         from '@/lib/msme/declarations'
import type { Declaration }         from '@/lib/msme/declarations'
import { chunk }                    from '@/lib/supabase/fetchAll'

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
    : currentPeriod(new Date().toISOString().slice(0, 10)).periodEnd
  const period = describePeriod(periodEnd)

  const [
    { data: vendors, error },
    { data: packRow },
    { data: addonRow },
    { count: totalEver },
  ] = await Promise.all([
    admin
      .from('msme_vendors')
      .select('id, vendor_name, vendor_email, gstin, pan, status, payment_status, udyam_number, udyam_registered_on, msme_category, nature_of_business, outstanding_amount, cert_url, is_not_msme, declarant_name, declared_at, submitted_at, email_count, last_emailed_at, is_paid, created_at, email_bounced, bounce_reason')
      .eq('org_id', mb.org_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
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
    admin
      .from('msme_vendors')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', mb.org_id)
      .gt('email_count', 0),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
      is_current: period.periodEnd === currentPeriod(new Date().toISOString().slice(0, 10)).periodEnd,
    },
    periods: periodsForFinancialYear(period.financialYear).map(p => ({
      period_end: p.periodEnd, label: p.label, short_label: p.shortLabel,
      as_on: p.asOn, range_label: p.rangeLabel, due_date: p.dueDate, half: p.half,
    })),
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
  const { vendor_name, vendor_email, gstin } = body

  if (!vendor_name?.trim() || !vendor_email?.trim()) {
    return NextResponse.json({ error: 'vendor_name and vendor_email are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor_email)) {
    return NextResponse.json({ error: 'Invalid vendor email address' }, { status: 400 })
  }

  const admin       = createAdminClient()
  const emailNorm   = vendor_email.trim().toLowerCase()

  // Fetch EVERY row for this email in one query — active and soft-deleted.
  //
  // This used to be two .maybeSingle() lookups whose errors were discarded.
  // maybeSingle() ERRORS when more than one row matches, and an org can hold
  // several soft-deleted rows for the same address (the unique index is
  // partial: `WHERE is_deleted = false`, so it constrains active rows only).
  // When that happened both lookups returned null, the reactivate branch was
  // skipped, and the request fell through to an insert — which is how an email
  // ends up looking permanently taken after a delete.
  const { data: sameEmail, error: lookupErr } = await admin
    .from('msme_vendors')
    .select('id, is_deleted, created_at')
    .eq('org_id', mb.org_id)
    .eq('vendor_email', emailNorm)
    .order('created_at', { ascending: false })

  // Never guess on a failed lookup: inserting here could breach the unique
  // index or silently duplicate a vendor.
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 })

  const activeRow  = (sameEmail ?? []).find(v => !v.is_deleted)
  const deletedRow = (sameEmail ?? []).find(v =>  v.is_deleted)

  if (activeRow) {
    return NextResponse.json({ error: 'A vendor with this email already exists' }, { status: 409 })
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
