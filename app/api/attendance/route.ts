import { createClient }           from '@/lib/supabase/server'
import { getAuthUser }            from '@/lib/supabase/authUser'
import { createAdminClient }      from '@/lib/supabase/admin'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'
import { canDo }                  from '@/lib/utils/permissionGate'
import { getApiOrgMembership }    from '@/lib/supabase/apiActiveOrg'
import { dbError }                from '@/lib/api-error'
import { orgToday }               from '@/lib/attendance/orgDay'
import { isIsoDate, isAttendanceStatus } from '@/lib/attendance'

const SELECT = `
  id, org_id, user_id, work_date, check_in_at, check_out_at,
  check_in_lat, check_in_lng, check_in_label,
  check_out_lat, check_out_lng, check_out_label,
  status, source, notes, recorded_by
`

/** Coordinates, or nulls if absent/unusable. Location is always optional. */
function coords(body: Record<string, unknown>, prefix: 'in' | 'out') {
  const lat = Number(body[`${prefix === 'in' ? 'check_in' : 'check_out'}_lat`])
  const lng = Number(body[`${prefix === 'in' ? 'check_in' : 'check_out'}_lng`])
  const label = body[`${prefix === 'in' ? 'check_in' : 'check_out'}_label`]

  // Reject anything outside real coordinate space rather than storing it.
  const ok = Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    // (0,0) is in the Atlantic. It is overwhelmingly a failed geolocation
    // call rather than a real check-in, and showing it on a map is worse
    // than showing nothing.
    && !(lat === 0 && lng === 0)

  return {
    lat:   ok ? lat : null,
    lng:   ok ? lng : null,
    label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 200) : null,
  }
}

/**
 * GET — attendance rows.
 *
 * Scope follows 'attendance.view_all': without it a member sees only their
 * own rows, exactly as /api/time-logs scopes by 'time.view_all'. Owners and
 * admins bypass the check inside canDo.
 *
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   date window (defaults to today only)
 *   ?user_id=<uuid>                  one member (ignored without view_all)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const canSeeAll = await canDo(admin, mb.org_id, user.id, mb.role, 'attendance.view_all')

  const sp   = request.nextUrl.searchParams
  const today = await orgToday(admin, mb.org_id)
  const from = isIsoDate(sp.get('from')) ? sp.get('from')! : today
  const to   = isIsoDate(sp.get('to'))   ? sp.get('to')!   : today

  let q = admin.from('attendance_records').select(SELECT)
    .eq('org_id', mb.org_id)
    .gte('work_date', from)
    .lte('work_date', to)

  if (!canSeeAll) {
    // Hard scope: a member without view_all only ever reads their own rows,
    // whatever user_id they pass.
    q = q.eq('user_id', user.id)
  } else if (sp.get('user_id')) {
    q = q.eq('user_id', sp.get('user_id')!)
  }

  const { data, error } = await q.order('work_date', { ascending: false }).limit(1000)
  if (error) return NextResponse.json(dbError(error, 'attendance:list'), { status: 500 })
  return NextResponse.json({ data: data ?? [], today })
}

/**
 * POST — check in or check out.
 *
 *   { action: 'check_in' | 'check_out', check_in_lat?, check_in_lng?, ... }
 *
 * Both actions act on the caller's own row for the org's current day. An
 * admin recording someone else's attendance uses PATCH on /api/attendance/[id]
 * or the manual-entry branch below, which is permission gated separately.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const action = body.action
  if (action !== 'check_in' && action !== 'check_out') {
    return NextResponse.json({ error: "action must be 'check_in' or 'check_out'" }, { status: 400 })
  }

  // A viewer is read-only everywhere else in the app; attendance is no
  // different. Every other role may record their own attendance — it is the
  // one HR action that should never need a permission grant.
  if (mb.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot record attendance' }, { status: 403 })
  }

  const workDate = await orgToday(admin, mb.org_id)
  const now      = new Date().toISOString()

  const { data: existing, error: readErr } = await admin.from('attendance_records')
    .select(SELECT)
    .eq('user_id', user.id)
    .eq('work_date', workDate)
    .maybeSingle()
  if (readErr) return NextResponse.json(dbError(readErr, 'attendance:read'), { status: 500 })

  if (action === 'check_in') {
    // Idempotent: tapping twice returns the open row rather than erroring or
    // overwriting the original check-in time with a later one.
    if (existing?.check_in_at && !existing.check_out_at) {
      return NextResponse.json({ data: existing, already: true })
    }
    // Already finished for the day — re-opening would silently discard the
    // recorded check-out, so refuse and let an admin correct it instead.
    if (existing?.check_out_at) {
      return NextResponse.json(
        { error: 'You have already checked out for today. Ask an admin to correct it.' },
        { status: 409 },
      )
    }

    const c = coords(body, 'in')
    const { data, error } = await admin.from('attendance_records').upsert({
      org_id:         mb.org_id,
      user_id:        user.id,
      work_date:      workDate,
      check_in_at:    now,
      check_in_lat:   c.lat,
      check_in_lng:   c.lng,
      check_in_label: c.label,
      status:         'present',
      source:         'self',
      updated_at:     now,
      // Target the unique index, so two taps racing each other resolve to one
      // row instead of one of them failing on the constraint.
    }, { onConflict: 'user_id,work_date' }).select(SELECT).maybeSingle()

    if (error) return NextResponse.json(dbError(error, 'attendance:check_in'), { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  }

  /* check_out */
  if (!existing?.check_in_at) {
    return NextResponse.json({ error: 'You have not checked in today' }, { status: 409 })
  }
  if (existing.check_out_at) {
    return NextResponse.json({ data: existing, already: true })
  }

  const c = coords(body, 'out')
  const { data, error } = await admin.from('attendance_records')
    .update({
      check_out_at:    now,
      check_out_lat:   c.lat,
      check_out_lng:   c.lng,
      check_out_label: c.label,
      updated_at:      now,
    })
    .eq('id', existing.id)
    // Re-assert ownership and org on the write itself. The row was read with
    // the service role, which bypasses RLS, so the WHERE clause is the only
    // thing standing between a crafted request and someone else's row.
    .eq('user_id', user.id)
    .eq('org_id', mb.org_id)
    .select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'attendance:check_out'), { status: 500 })
  return NextResponse.json({ data })
}

/**
 * PUT — an admin records or corrects a member's day.
 * Gated on 'attendance.edit'; owner/admin bypass inside canDo.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'attendance.edit')) {
    return NextResponse.json({ error: 'Not allowed to edit attendance' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const targetUser = String(body.user_id ?? '')
  const workDate   = body.work_date
  if (!targetUser) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!isIsoDate(workDate)) return NextResponse.json({ error: 'work_date must be YYYY-MM-DD' }, { status: 400 })

  // The target must be a member of THIS org. Without this an admin could
  // write an attendance row for any user id in the system.
  const { data: targetMb } = await admin.from('org_members')
    .select('user_id').eq('org_id', mb.org_id).eq('user_id', targetUser).maybeSingle()
  if (!targetMb) return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 404 })

  const status = isAttendanceStatus(body.status) ? body.status : 'present'
  const now    = new Date().toISOString()

  const { data, error } = await admin.from('attendance_records').upsert({
    org_id:       mb.org_id,
    user_id:      targetUser,
    work_date:    workDate,
    check_in_at:  typeof body.check_in_at  === 'string' ? body.check_in_at  : null,
    check_out_at: typeof body.check_out_at === 'string' ? body.check_out_at : null,
    status,
    source:       'manual',
    notes:        typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
    recorded_by:  user.id,
    updated_at:   now,
  }, { onConflict: 'user_id,work_date' }).select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'attendance:manual'), { status: 500 })
  return NextResponse.json({ data })
}
