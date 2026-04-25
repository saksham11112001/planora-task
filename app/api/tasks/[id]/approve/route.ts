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

  const { decision, comment } = await req.json()
  if (!['submit', 'approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }
  const isAssignee    = task.assignee_id === user.id
  const isOwnerOrAdmin = ['owner', 'admin'].includes(mb.role)

  // ── Who can do what ────────────────────────────────────────────────────────
  // submit: the assignee OR any owner/admin
  if (decision === 'submit') {
    if (!isAssignee && !isOwnerOrAdmin) return NextResponse.json({ error: 'Only the assignee can submit for approval' }, { status: 403 })

    // Block submit if this task is blocked by incomplete tasks
    const blockedByIds: string[] = (task as any).custom_fields?._blocked_by ?? []
    if (blockedByIds.length > 0) {
      // Use a single .in() query instead of N individual queries
      const { data: blockerTasks } = await supabase
        .from('tasks').select('id, title, status')
        .in('id', blockedByIds).eq('org_id', mb.org_id)
      const incomplete = (blockerTasks ?? []).filter(t => t.status !== 'completed').map(t => t.title as string)
      if (incomplete.length > 0) {
        const names = incomplete.slice(0, 2).join(', ') + (incomplete.length > 2 ? ` +${incomplete.length - 2} more` : '')
        return NextResponse.json({
          error: `Blocked by: ${names}. Complete those tasks first.`,
          code: 'BLOCKED_BY_INCOMPLETE',
        }, { status: 422 })
      }
    }

    // Block submit if subtasks are incomplete
    // Owner/admin bypass: they can force-submit regardless of subtask state
    // _compliance_subtask rows are attachment-header placeholders — not real work items,
    // so they are always excluded from this gate.
    const { data: subtasks } = await supabase
      .from('tasks').select('id, status, parent_task_id, custom_fields').eq('parent_task_id', id).eq('org_id', mb.org_id)
    const realSubtasks = (subtasks ?? []).filter((s: any) => s.custom_fields?._compliance_subtask !== true)
    if (!isOwnerOrAdmin && realSubtasks.length > 0) {
      const incomplete = realSubtasks.filter((s: any) => s.status !== 'completed')
      if (incomplete.length > 0) {
        return NextResponse.json({
          error: `Complete all subtasks first — ${incomplete.length} remaining`,
          code: 'SUBTASKS_INCOMPLETE',
        }, { status: 422 })
      }
    }

    // CA compliance tasks: check attachment count against CA master requirement
    const isCaCompliance =
      (task as any).custom_fields?._ca_compliance === true ||
      subtasks?.some((s: any) => s.custom_fields?._compliance_subtask === true)
    if (isCaCompliance) {
      // Look up how many attachments the admin requires for this task in the CA master
      const { data: masterTask } = await supabase
        .from('ca_master_tasks')
        .select('attachment_count, attachment_headers')
        .eq('org_id', mb.org_id)
        .eq('name', task.title)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      const requiredCount = Math.max(1, masterTask?.attachment_count ?? 1)
      const { data: attachments } = await supabase
        .from('task_attachments').select('id').eq('task_id', id).eq('org_id', mb.org_id)
      const actualCount = attachments?.length ?? 0

      if (actualCount < requiredCount) {
        const headers: string[] = masterTask?.attachment_headers ?? []
        const headerList = headers.length > 0 ? ` (${headers.join(', ')})` : ''
        const missing = requiredCount - actualCount
        return NextResponse.json({
          error: `${missing} more attachment${missing > 1 ? 's' : ''} required before submission${headerList} — ${actualCount} of ${requiredCount} uploaded`,
          code: 'ATTACHMENT_REQUIRED',
        }, { status: 422 })
      }
    }

    // If no approver is assigned → auto-complete regardless of approval_required
    // (there is nobody who could approve it, so just complete the task)
    if (!task.approver_id) {
      await supabase.from('tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        approval_status: 'approved',
      }).eq('id', id)
      return NextResponse.json({ ok: true, message: 'Task completed', auto_completed: true })
    }

    const existingCfForSubmit = (task as any).custom_fields ?? {}
    await supabase.from('tasks').update({
      approval_status: 'pending', status: 'in_review',
      custom_fields: { ...existingCfForSubmit, _submitted_by: user.id },
    }).eq('id', id)

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

  // approve / reject: designated approver OR any owner/admin
  if (!task.approver_id && !isOwnerOrAdmin) {
    return NextResponse.json({ error: 'No approver assigned to this task' }, { status: 403 })
  }
  if (task.approver_id && task.approver_id !== user.id && !isOwnerOrAdmin) {
    return NextResponse.json({ error: 'Only the designated approver can approve or reject this task' }, { status: 403 })
  }
  // Block self-approval: whoever submitted cannot also approve/reject
  const submittedBy = (task as any).custom_fields?._submitted_by
  if (submittedBy && submittedBy === user.id) {
    return NextResponse.json({ error: 'You submitted this task for approval — another approver must review it' }, { status: 403 })
  }

  if (decision === 'approve') {
    // Block approving a parent task if real subtasks are still incomplete.
    // _compliance_subtask rows are attachment-header placeholders — excluded from this gate.
    // Owner/admin bypass: they can force-approve regardless of subtask state
    const { data: subtasksForApprove } = await supabase
      .from('tasks').select('id, status, custom_fields').eq('parent_task_id', id).eq('org_id', mb.org_id)
    const realSubtasksForApprove = (subtasksForApprove ?? []).filter((s: any) => s.custom_fields?._compliance_subtask !== true)
    if (!isOwnerOrAdmin && realSubtasksForApprove.length > 0) {
      const incomplete = realSubtasksForApprove.filter((s: any) => s.status !== 'completed')
      if (incomplete.length > 0) {
        return NextResponse.json({
          error: `Cannot approve — ${incomplete.length} subtask${incomplete.length > 1 ? 's are' : ' is'} still incomplete`,
          code: 'SUBTASKS_INCOMPLETE',
        }, { status: 422 })
      }
    }

    const cfForApprove = { ...((task as any).custom_fields ?? {}) }
    delete cfForApprove._submitted_by
    await supabase.from('tasks').update({
      approval_status: 'approved', status: 'completed',
      approved_by: user.id, approved_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      custom_fields: cfForApprove,
    }).eq('id', id)
  } else if (decision === 'reject') {
    const existingCf = { ...((task as any).custom_fields ?? {}) }
    delete existingCf._submitted_by
    const updatedCf  = comment?.trim()
      ? { ...existingCf, _rejection_comment: comment.trim() }
      : existingCf
    await supabase.from('tasks').update({
      approval_status: 'rejected', status: 'todo', approved_by: user.id,
      approved_at: new Date().toISOString(),
      custom_fields: updatedCf,
    }).eq('id', id)
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
            decision:         (decision === 'approve' ? 'approved' : 'rejected') as 'approved' | 'rejected',
            assignee_id:      task.assignee_id,
            assignee_email:   assigneeProfile.email,
            assignee_phone:   assigneeProfile.phone_number ?? null,
            reviewer_name:    (mb.users as any)?.name ?? 'Your manager',
            org_name:         (mb.organisations as any)?.name ?? 'Your org',
            rejection_comment: comment?.trim() ?? null,
          },
        })
      }
    } catch {}
  }

  return NextResponse.json({ ok: true })
}
