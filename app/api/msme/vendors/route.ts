import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { resolvePackEntitlement }   from '@/lib/msme/packs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()

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

  // Packs run for a year. resolvePackEntitlement is the single place that
  // decides what the term means, so the list, the send gates and settings can
  // never disagree about whether an org still has its slots.
  const addonSlots: number = (addonRow?.config as any)?.extra_slots ?? 0
  const ent = resolvePackEntitlement(packRow?.config as any, addonSlots)
  const total = vendors?.length ?? 0
  return NextResponse.json({
    vendors: vendors ?? [], total, totalEver: totalEver ?? 0,
    vendorLimit: ent.vendorLimit,
    // Surfaced so the dashboard can show renewal state rather than silently
    // showing fewer slots than the customer thinks they bought.
    packExpiresAt: ent.expiresAt,
    packExpired:   ent.isExpired,
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
        email_count:    0,
        last_emailed_at: null,
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
