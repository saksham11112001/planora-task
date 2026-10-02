import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'
import { isIsoDate, isLeaveType, leaveDaysCount, rangesOverlap } from '@/lib/attendance'

const SELECT = `
  id, org_id, user_id, leave_type, start_date, end_date, half_day,
  days_count, reason, status, decided_by, decided_at, decision_note, created_at
`

/** A request longer than this is a data-entry error, not a holiday. */
const MAX_RANGE_DAYS = 400

/**
 * GET — leave requests.
 *
 * Without 'leave.view_all' a member sees only their own, mirroring how
 * attendance and time logs scope. Owners and admins bypass inside canDo.
 *
 *   ?status=pending   filter by status
 *   ?user_id=<uuid>   one member (ignored without view_all)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const canSeeAll = await canDo(admin, mb.org_id, user.id, mb.role, 'leave.view_all')

  const sp = request.nextUrl.searchParams
  let q = admin.from('leave_requests').select(SELECT).eq('org_id', mb.org_id)

  if (!canSeeAll) q = q.eq('user_id', user.id)
  else if (sp.get('user_id')) q = q.eq('user_id', sp.get('user_id')!)

  const status = sp.get('status')
  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
    q = q.eq('status', status)
  }

  const { data, error } = await q.order('start_date', { ascending: false }).limit(500)
  if (error) return NextResponse.json(dbError(error, 'leave:list'), { status: 500 })
  return NextResponse.json({ data: data ?? [], canApprove: await canDo(admin, mb.org_id, user.id, mb.role, 'leave.approve') })
}

/**
 * POST — submit a leave request for yourself.
 *
 * Any role except viewer may request leave for themselves; asking for time
 * off is not an administrative action. Approving it is — see
 * /api/leave/[id].
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (mb.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot request leave' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const startDate = body.start_date
  const endDate   = body.end_date
  const halfDay   = body.half_day === true
  const leaveType = isLeaveType(body.leave_type) ? body.leave_type : 'casual'

  if (!isIsoDate(startDate)) return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 })
  if (!isIsoDate(endDate))   return NextResponse.json({ error: 'end_date must be YYYY-MM-DD' },   { status: 400 })
  if (endDate < startDate)   return NextResponse.json({ error: 'end_date cannot be before start_date' }, { status: 400 })

  if (halfDay && startDate !== endDate) {
    // Rather than guessing which half of a multi-day range is meant.
    return NextResponse.json({ error: 'A half day must start and end on the same date' }, { status: 400 })
  }

  const span = Math.round(
    (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000,
  ) + 1
  if (span > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `A leave request cannot span more than ${MAX_RANGE_DAYS} days` }, { status: 400 })
  }

  const daysCount = leaveDaysCount(startDate, endDate, halfDay)
  if (daysCount <= 0) {
    // Every day in the range was a weekend.
    return NextResponse.json({ error: 'That range contains no working days' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Reject a request that collides with one the member already has open or
  // approved. Checked in the API rather than with an exclusion constraint so
  // the user gets a readable message naming the clashing dates.
  const { data: clashes, error: clashErr } = await admin.from('leave_requests')
    .select('id, start_date, end_date, status')
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1)
  if (clashErr) return NextResponse.json(dbError(clashErr, 'leave:clash'), { status: 500 })

  const clash = clashes?.[0]
  if (clash && rangesOverlap(startDate, endDate, clash.start_date, clash.end_date)) {
    return NextResponse.json(
      { error: `This overlaps a ${clash.status} request for ${clash.start_date} to ${clash.end_date}` },
      { status: 409 },
    )
  }

  const { data, error } = await admin.from('leave_requests').insert({
    org_id:     mb.org_id,
    user_id:    user.id,
    leave_type: leaveType,
    start_date: startDate,
    end_date:   endDate,
    half_day:   halfDay,
    days_count: daysCount,
    reason:     typeof body.reason === 'string' ? body.reason.slice(0, 1000) : null,
    status:     'pending',
  }).select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'leave:create'), { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
