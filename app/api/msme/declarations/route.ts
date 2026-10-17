// Buyer-side fields on a period's declaration.
//
// Form MSME-1 asks the BUYER for two things the vendor cannot supply: the
// reason payment is outstanding, and the date from which it has been. The
// date is derived from the invoice ledger wherever one has been imported;
// this route is how both get filled in by hand when it has not.
//
// Keyed on (vendor_id, period_end) rather than a declaration id, so the
// caller does not have to hold an id it never otherwise needs — and so the
// declaration is created if this is the first thing written for the period.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser }              from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { isValidPeriodEnd }         from '@/lib/msme/periods'
import { ensureDeclaration }        from '@/lib/msme/declarations'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_REASON = 500

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only managers and above can edit a declaration' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const vendorId  = body?.vendor_id
  const periodEnd = body?.period_end

  if (typeof vendorId !== 'string' || !vendorId) {
    return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
  }
  if (!isValidPeriodEnd(periodEnd)) {
    return NextResponse.json({ error: 'period_end must be a reporting period end (31 March or 30 September)' }, { status: 400 })
  }

  const admin = createAdminClient()

  // The vendor must belong to THIS org. Without it the vendor id from the
  // request body would reach a declaration in someone else's org.
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('id')
    .eq('id', vendorId)
    .eq('org_id', mb.org_id)
    .maybeSingle()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if ('delay_reason' in (body ?? {})) {
    const raw = body.delay_reason
    if (raw !== null && typeof raw !== 'string') {
      return NextResponse.json({ error: 'delay_reason must be text or null' }, { status: 400 })
    }
    const text = raw === null ? null : raw.trim().slice(0, MAX_REASON)
    patch.delay_reason = text || null
  }

  if ('due_from_date' in (body ?? {})) {
    const raw = body.due_from_date
    if (raw !== null && !(typeof raw === 'string' && ISO_DATE.test(raw))) {
      return NextResponse.json({ error: 'due_from_date must be YYYY-MM-DD or null' }, { status: 400 })
    }
    patch.due_from_date = raw || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Created if absent: a firm may fill the delay reason for a vendor whose
  // cycle has not been opened yet, and refusing that would be an odd place to
  // stop them.
  const declaration = await ensureDeclaration(admin, {
    orgId: mb.org_id, vendorId, periodEnd,
  })
  if (!declaration) {
    return NextResponse.json({ error: 'Could not open a declaration for this period' }, { status: 500 })
  }

  const { error } = await admin
    .from('msme_declarations')
    .update(patch)
    .eq('id', declaration.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // No mirror sync: neither field is mirrored onto the vendor row, because
  // neither exists there — they are the buyer's own words about one period.
  return NextResponse.json({ ok: true })
}
