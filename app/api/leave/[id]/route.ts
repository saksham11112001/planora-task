import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'

const SELECT = `
  id, org_id, user_id, leave_type, start_date, end_date, half_day,
  days_count, reason, status, decided_by, decided_at, decision_note, created_at
`

/**
 * PATCH — decide or cancel a leave request.
 *
 *   { decision: 'approve' | 'reject', note? }   requires 'leave.approve'
 *   { decision: 'cancel' }                      the requester's own, while pending
 *
 * Approving also moves the days onto the member's balance for the year the
 * leave STARTS in. Reversing an approval gives them back. The arithmetic
 * lives here rather than in a database trigger so it sits inside the same
 * permission check that authorised the decision.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const decision = body.decision
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'cancel') {
    return NextResponse.json({ error: "decision must be 'approve', 'reject' or 'cancel'" }, { status: 400 })
  }

  // Scope the read to this org. The service role bypasses RLS, so without
  // the org filter an id from another firm would resolve.
  const { data: req, error: readErr } = await admin.from('leave_requests')
    .select(SELECT).eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (readErr) return NextResponse.json(dbError(readErr, 'leave:read'), { status: 500 })
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()

  /* ── Cancel: the requester withdrawing their own pending request ──────── */
  if (decision === 'cancel') {
    const isOwnRequest = req.user_id === user.id
    const mayDecide    = await canDo(admin, mb.org_id, user.id, mb.role, 'leave.approve')
    if (!isOwnRequest && !mayDecide) {
      return NextResponse.json({ error: 'You can only cancel your own request' }, { status: 403 })
    }
    if (req.status !== 'pending') {
      // Cancelling an approved request would need the balance returning; that
      // is a reversal, which is an approver's action via 'reject'.
      return NextResponse.json(
        { error: `Only a pending request can be cancelled — this one is ${req.status}` },
        { status: 409 },
      )
    }

    const { data, error } = await admin.from('leave_requests')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', id).eq('org_id', mb.org_id)
      // Guard the transition itself: if another tab approved it between the
      // read above and this write, the update matches nothing rather than
      // overwriting the approval.
      .eq('status', 'pending')
      .select(SELECT).maybeSingle()
    if (error) return NextResponse.json(dbError(error, 'leave:cancel'), { status: 500 })
    if (!data) return NextResponse.json({ error: 'That request was just decided by someone else' }, { status: 409 })
    return NextResponse.json({ data })
  }

  /* ── Approve / reject ─────────────────────────────────────────────────── */
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'leave.approve')) {
    return NextResponse.json({ error: 'Not allowed to decide leave requests' }, { status: 403 })
  }

  // Nobody approves their own leave, including an admin. Permission bypass is
  // about authority over others, not about self-approval.
  if (req.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot decide your own leave request' }, { status: 403 })
  }

  const newStatus = decision === 'approve' ? 'approved' : 'rejected'
  if (req.status === newStatus) {
    return NextResponse.json({ data: req, already: true })
  }
  if (req.status === 'cancelled') {
    return NextResponse.json({ error: 'That request was cancelled by the requester' }, { status: 409 })
  }

  const { data, error } = await admin.from('leave_requests')
    .update({
      status:        newStatus,
      decided_by:    user.id,
      decided_at:    now,
      decision_note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
      updated_at:    now,
    })
    .eq('id', id).eq('org_id', mb.org_id)
    // Only move from the status we read. Two approvers clicking at once
    // means the second one gets the conflict rather than double-counting
    // the days against the balance below.
    .eq('status', req.status)
    .select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'leave:decide'), { status: 500 })
  if (!data) return NextResponse.json({ error: 'That request was just decided by someone else' }, { status: 409 })

  /* ── Balance ──────────────────────────────────────────────────────────── */
  // Charged to the year the leave STARTS in, so a request crossing New Year
  // lands in one place rather than being split.
  const year  = Number(req.start_date.slice(0, 4))
  const delta =
      decision === 'approve'           ?  Number(req.days_count)   // consume
    : req.status === 'approved'        ? -Number(req.days_count)   // reversal
    : 0                                                            // pending -> rejected

  if (delta !== 0) {
    const { data: bal } = await admin.from('leave_balances')
      .select('id, used')
      .eq('user_id', req.user_id).eq('year', year).eq('leave_type', req.leave_type)
      .maybeSingle()

    if (bal) {
      // Never let a reversal push 'used' below zero — that would hand out
      // phantom entitlement if the same approval were reversed twice.
      const next = Math.max(0, Number(bal.used) + delta)
      await admin.from('leave_balances')
        .update({ used: next, updated_at: now }).eq('id', bal.id)
    } else if (delta > 0) {
      // No balance row configured for this type yet. Record the usage with a
      // zero entitlement so the days are not lost; an admin can set the
      // entitlement afterwards and the used figure is already correct.
      await admin.from('leave_balances').insert({
        org_id:     mb.org_id,
        user_id:    req.user_id,
        year,
        leave_type: req.leave_type,
        entitled:   0,
        used:       delta,
      })
    }
  }

  return NextResponse.json({ data })
}
