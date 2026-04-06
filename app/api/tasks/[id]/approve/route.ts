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
    .select('id, title, status, approval_status, approval_required, assignee_id, approver_id, org_id, parent_task_id, custom_fields')
    .eq('id', id).eq('org_id', mb.org_id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { decision } = await req.json()
  const isAssignee   = task.assignee_id === user.id

  // ── Who can do what ────────────────────────────────────────────────────────
  // submit: only the assignee
  if (decision === 'submit') {
    if (!isAssignee) return NextResponse.json({ error: 'Only the assignee can submit for approval' }, { status: 403 })

    // Block submit if subtasks are incomplete
    const { data: subtasks } = await supabase
      .from('tasks').select('id, status, parent_task_id, custom_fields').eq('parent_task_id', id)
    if (subtasks && subtasks.length > 0) {
      const incomplete = subtasks.filter((s: any) => s.status !== 'completed')
      if (incomplete.length > 0) {
        return NextResponse.json({
          error: `Complete all subtasks first — ${incomplete.length} remaining`,
          code: 'SUBTASKS_INCOMPLETE',
        }, { status: 422 })
      }
    }

    // CA compliance tasks require at least one attachment or drive link
    const isCaCompliance =
      (task as any).custom_fields?._ca_compliance === true ||
      subtasks?.some((s: any) => s.custom_fields?._compliance_subtask === true)
    if (isCaCompliance) {
      const { data: attachments } = await supabase
        .from('task_attachments').select('id').eq('task_id', id).limit(1)
      if (!attachments || attachments.length === 0) {
        return NextResponse.json({
          error: 'CA compliance tasks require at least one document or drive link before submission',
          code: 'ATTACHMENT_REQUIRED',
        }, { status: 422 })
      }
    }

    // If no approver is assigned and approval is not required → auto-complete
    if (!task.approver_id && !task.approval_required) {
      await supabase.from('tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        approval_status: 'approved',
      }).eq('id', id)
      return NextResponse.json({ ok: true, message: 'Task completed', auto_completed: true })
    }

    // If approval_required but no approver is set → block with a clear message
    if (!task.approver_id && task.approval_required) {
      return NextResponse.json({
        error: 'No approver assigned — ask a manager to add an approver before submitting',
        code: 'NO_APPROVER',
      }, { status: 422 })
    }

    await supabase.from('tasks').update({ approval_status: 'pending', status: 'in_review' }).eq('id', id)

    // Notify designated approver
    const { data: approverProfile } = await supabase
      .from('users').select('email, name, phone_number').eq('id', task.approver_id!).single()
    if (approverProfile?.email) {
      try {
        await inngest.send({
          name: 'task/approval-requested',
          data: {
            task_id: id, task_title: task.title,
            submitter_name: (mb.users as any)?.name ?? 'A team member',
            manager_email:  approverProfile.email,
            manager_phone:  (approverProfile as any).phone_number ?? null,
            org_name:       (mb.organisations as any)?.name ?? 'Your org',
          },
        })
      } catch {}
    }
    return NextResponse.json({ ok: true, message: 'Submitted for approval' })
  }

  // approve / reject: only the exact designated approver — no fallback to any manager
  if (!task.approver_id) {
    return NextResponse.json({ error: 'No approver assigned to this task' }, { status: 403 })
  }
  if (task.approver_id !== user.id) {
    return NextResponse.json({ error: 'Only the designated approver can approve or reject this task' }, { status: 403 })
  }

  if (decision === 'approve') {
    // Block approving a parent task if subtasks are still incomplete
    const { data: subtasksForApprove } = await supabase
      .from('tasks').select('id, status').eq('parent_task_id', id)
    if (subtasksForApprove && subtasksForApprove.length > 0) {
      const incomplete = subtasksForApprove.filter((s: any) => s.status !== 'completed')
      if (incomplete.length > 0) {
        return NextResponse.json({
          error: `Cannot approve — ${incomplete.length} subtask${incomplete.length > 1 ? 's are' : ' is'} still incomplete`,
          code: 'SUBTASKS_INCOMPLETE',
        }, { status: 422 })
      }
    }

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
            decision:       (decision === 'approve' ? 'approved' : 'rejected') as 'approved' | 'rejected',
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
