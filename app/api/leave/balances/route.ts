import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'
import { isLeaveType }         from '@/lib/attendance'

const SELECT = 'id, user_id, year, leave_type, entitled, used'

/** GET — leave balances for a year. Own rows only without 'leave.view_all'. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const canSeeAll = await canDo(admin, mb.org_id, user.id, mb.role, 'leave.view_all')

  const raw  = Number(request.nextUrl.searchParams.get('year'))
  // Clamp rather than trust: an out-of-range year is a typo or a probe.
  const year = Number.isInteger(raw) && raw >= 2000 && raw <= 2100
    ? raw
    : new Date().getUTCFullYear()

  let q = admin.from('leave_balances').select(SELECT).eq('org_id', mb.org_id).eq('year', year)
  if (!canSeeAll) q = q.eq('user_id', user.id)

  const { data, error } = await q.limit(1000)
  if (error) return NextResponse.json(dbError(error, 'leave:balances'), { status: 500 })
  return NextResponse.json({ data: data ?? [], year })
}

/**
 * PUT — set a member's entitlement for a leave type and year.
 * Requires 'leave.manage_balances'. Only `entitled` is settable here:
 * `used` is derived from approvals and must never be typed in, or the two
 * would disagree with the request history.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'leave.manage_balances')) {
    return NextResponse.json({ error: 'Not allowed to set leave balances' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const targetUser = String(body.user_id ?? '')
  const year       = Number(body.year)
  const entitled   = Number(body.entitled)

  if (!targetUser) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!isLeaveType(body.leave_type)) return NextResponse.json({ error: 'Unknown leave_type' }, { status: 400 })
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year out of range' }, { status: 400 })
  }
  if (!Number.isFinite(entitled) || entitled < 0 || entitled > 365) {
    return NextResponse.json({ error: 'entitled must be between 0 and 365' }, { status: 400 })
  }

  // The target must belong to this org — the same guard as manual attendance.
  const { data: targetMb } = await admin.from('org_members')
    .select('user_id').eq('org_id', mb.org_id).eq('user_id', targetUser).maybeSingle()
  if (!targetMb) return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 404 })

  // Upsert on the natural key. 'used' is intentionally absent from the
  // payload so an existing row keeps the figure derived from approvals.
  const { data, error } = await admin.from('leave_balances').upsert({
    org_id:     mb.org_id,
    user_id:    targetUser,
    year,
    leave_type: body.leave_type,
    entitled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,year,leave_type' }).select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'leave:set_balance'), { status: 500 })
  return NextResponse.json({ data })
}
