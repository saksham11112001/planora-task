import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { inngest }                   from '@/lib/inngest/client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }    = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role, organisations(name), users(name)')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, status, approval_status, approval_required, assignee_id, approver_id, org_id')
    .eq('id', id).eq('org_id', mb.org_id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { decision } = await req.json()
  const isAssignee   = task.assignee_id === user.id
  const isOrgManager = ['owner', 'admin', 'manager'].includes(mb.role)

  // ── Who can do what ────────────────────────────────────────────────────────
  // submit: only the assignee
  if (decision === 'submit') {
    if (!isAssignee) return NextResponse.json({ error: 'Only the assignee can submit' }, { status: 403 })
    await supabase.from('tasks').update({ approval_status: 'pending', status: 'in_review' }).eq('id', id)

    // Notify designated approver if set, otherwise all managers
    if (task.approver_id) {
      const { data: approverProfile } = await supabase
        .from('users').select('email, name, phone_number').eq('id', task.approver_id).single()
      if (approverProfile?.email) {
        try {
          await inngest.send({
            name: 'task/approval-requested',
            data: {
              task_id: id, task_title: task.title,
              submitter_name: (mb.users as any)?.name ?? 'A team member',
              manager_email:  approverProfile.email,
              manager_phone:  approverProfile.phone_number ?? null,
              org_name:       (mb.organisations as any)?.name ?? 'Your org',
            },
          })
        } catch {}
      }
    }
    return NextResponse.json({ ok: true, message: 'Submitted for approval' })
  }

  // approve / reject: only the designated approver OR any org manager if no approver set
  const isDesignatedApprover = task.approver_id
    ? task.approver_id === user.id
    : isOrgManager

  if (!isDesignatedApprover) {
    const msg = task.approver_id
      ? 'Only the designated approver can approve or reject this task'
      : 'Only managers can approve or reject tasks'
    return NextResponse.json({ error: msg }, { status: 403 })
  }

  if (decision === 'approve') {
    await supabase.from('tasks').update({
      approval_status: 'approved', status: 'completed',
      approved_by: user.id, approved_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }).eq('id', id)
  } else if (decision === 'reject') {
    await supabase.from('tasks').update({
      approval_status: 'rejected', status: 'in_progress', approved_by: user.id,
    }).eq('id', id)
  } else {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  // Notify assignee
  if (task.assignee_id) {
    try {
      const { data: assigneeProfile } = await supabase
        .from('users').select('email, phone_number').eq('id', task.assignee_id).single()
      if (assigneeProfile?.email) {
        await inngest.send({
          name: 'task/approval-completed',
          data: {
            task_id: id, task_title: task.title,
            decision:       decision as 'approved' | 'rejected',
            assignee_id:    task.assignee_id,
            assignee_email: assigneeProfile.email,
            assignee_phone: assigneeProfile.phone_number ?? null,
            reviewer_name:  (mb.users as any)?.name ?? 'Your manager',
            org_name:       (mb.organisations as any)?.name ?? 'Your org',
          },
        })
      }
    } catch {}
  }

  return NextResponse.json({ ok: true })
}
