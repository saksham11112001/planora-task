import { createClient }     from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest }            from '@/lib/inngest/client'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { assertCan }          from '@/lib/utils/permissionGate'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const { data, error } = await supabase.from('tasks')
    .select('*, assignee:users!tasks_assignee_id_fkey(id,name), approver:users!tasks_approver_id_fkey(id,name), projects(id,name,color), clients(id,name,color)')
    .eq('id', id).eq('org_id', mb.org_id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data: task } = await supabase
    .from('tasks')
    .select('id, assignee_id, approver_id, org_id, approval_required, approval_status, status, parent_task_id, custom_fields')
    .eq('id', id).eq('org_id', mb.org_id).single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isManager     = ['owner','admin','manager'].includes(mb.role)
  const isOwnerOrAdmin = ['owner','admin'].includes(mb.role)
  const isAssignee = task.assignee_id === user.id
  const isApprover = task.approver_id
    ? task.approver_id === user.id
    : isManager

  if (!isManager && !isAssignee)
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()

  // ── PERMISSION GATE ────────────────────────────────────────────────────────
  // Complete task
  if (body.status === 'completed' || body.status === 'in_review') {
    const denied = await assertCan(supabase, mb.org_id, mb.role, 'tasks.complete')
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  }
  // Re-assign task to someone else
  if ('assignee_id' in body && body.assignee_id !== task.assignee_id) {
    const denied = await assertCan(supabase, mb.org_id, mb.role, 'tasks.assign')
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  }
  // General edit permission: assignees check edit_own, non-assignees check edit
  {
    const perm = isAssignee ? 'tasks.edit_own' : 'tasks.edit'
    const denied = await assertCan(supabase, mb.org_id, mb.role, perm)
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  // ── APPROVAL GATE ──────────────────────────────────────────────
  // Block completing a PARENT task if it has incomplete subtasks
  if (body.status === 'completed' && !task.parent_task_id) {
    const { data: subtasks } = await supabase
      .from('tasks').select('id, status').eq('parent_task_id', id)
    if (subtasks && subtasks.length > 0) {
      const incomplete = subtasks.filter(s => s.status !== 'completed')
      if (incomplete.length > 0) {
        return NextResponse.json({
          error: `Complete all subtasks first — ${incomplete.length} remaining`,
          code: 'SUBTASKS_INCOMPLETE',
        }, { status: 422 })
      }
    }
  }

  // Block completing a COMPLIANCE SUBTASK if no attachment uploaded
  // Only applies to subtasks flagged with { _compliance_subtask: true } in custom_fields
  if (body.status === 'completed' && task.parent_task_id) {
    const isComplianceSubtask = (task as any).custom_fields?._compliance_subtask === true
    if (isComplianceSubtask) {
      // Check attachments on the subtask itself first, then fall back to parent task
      const { data: subtaskAttachments } = await supabase
        .from('task_attachments').select('id').eq('task_id', id).limit(1)
      let hasAttachment = !!(subtaskAttachments && subtaskAttachments.length > 0)
      if (!hasAttachment) {
        const { data: parentAttachments } = await supabase
          .from('task_attachments').select('id').eq('task_id', task.parent_task_id).limit(1)
        hasAttachment = !!(parentAttachments && parentAttachments.length > 0)
      }
      if (!hasAttachment) {
        return NextResponse.json({
          error: `Upload the required document before marking this compliance subtask complete`,
          code: 'ATTACHMENT_REQUIRED',
        }, { status: 422 })
      }
    }
  }

  // If someone tries to directly set status=completed on an approval-required task
  // that hasn't been approved yet, block it and tell them to use the approve flow.
  if (
    body.status === 'completed' &&
    task.approval_required &&
    task.approval_status !== 'approved'
  ) {
    // Owners/admins can bypass the approval gate entirely; so can the designated approver
    if (!isApprover && !isOwnerOrAdmin) {
      return NextResponse.json({
        error: 'This task requires approval before it can be completed. Use "Submit for approval" instead.',
        code: 'APPROVAL_REQUIRED',
      }, { status: 422 })
    }
    // Approver completing directly → also mark as approved
    body.approval_status = 'approved'
    body.approved_by     = user.id
    body.approved_at     = new Date().toISOString()
  }

  // Members can only update status/completed_at of tasks assigned to them
  // Managers can update all fields on any task in their org
  const ALLOWED = isManager ? [
    'title','description','status','priority','due_date','start_date',
    'completed_at','assignee_id','client_id','approval_status',
    'approval_required','approved_by','approved_at',
    'estimated_hours','sort_order','custom_fields',
    'next_occurrence_date','is_recurring',
  ] : [
    // Members: only status + completed_at (to submit/complete their own tasks)
    'status','completed_at','custom_fields',
  ]
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }
  if (!Object.keys(updates).length)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  // Merge custom_fields rather than overwrite — preserve existing flags (_ca_compliance, etc.)
  if (updates.custom_fields && typeof updates.custom_fields === 'object') {
    updates.custom_fields = {
      ...((task as any).custom_fields ?? {}),
      ...(updates.custom_fields as Record<string, unknown>),
    }
  }

  const { data, error } = await supabase
    .from('tasks').update(updates).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-complete parent when all subtasks done — only if parent doesn't require approval
  if (updates.status === 'completed' && data?.parent_task_id) {
    const { data: siblings } = await supabase
      .from('tasks').select('id, status')
      .eq('parent_task_id', data.parent_task_id)
    if (siblings?.length && siblings.every(s => s.status === 'completed')) {
      const { data: parentTask } = await supabase
        .from('tasks').select('approval_required, approval_status')
        .eq('id', data.parent_task_id).single()
      // Skip auto-complete if parent requires approval and hasn't been approved yet
      if (!parentTask?.approval_required || parentTask?.approval_status === 'approved') {
        await supabase.from('tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', data.parent_task_id)
      }
    }
  }

  // Fire notification if assignee changed to a different person
  const newAssigneeId = body.assignee_id
  if (newAssigneeId && newAssigneeId !== user.id &&
      newAssigneeId !== task.assignee_id) {
    try {
      const admin = createAdminClient()
      const { data: assignee } = await admin.from('users')
        .select('email, phone_number').eq('id', newAssigneeId).single()
      const { data: assigner } = await admin.from('users')
        .select('name').eq('id', user.id).single()
      const { data: org } = await admin.from('organisations')
        .select('name').eq('id', mb.org_id).single()
      if (assignee?.email) {
        await inngest.send({
          name: 'task/assigned',
          data: {
            task_id: id,
            task_title: data.title,
            assignee_id: newAssigneeId,
            assignee_email: assignee.email,
            assignee_phone: (assignee as any).phone_number ?? null,
            assigner_name: (assigner as any)?.name ?? 'Someone',
            org_id: mb.org_id,
            org_name: (org as any)?.name ?? '',
            due_date: data.due_date ?? null,
            project_name: null,
          },
        })
      }
    } catch (e) { console.error('[task PATCH notify]', e) }
  }

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const deleteDenied = await assertCan(supabase, mb.org_id, mb.role, 'tasks.delete')
  if (deleteDenied) return NextResponse.json({ error: deleteDenied.error }, { status: deleteDenied.status })
  // Soft delete — move to trash with deleted_at timestamp
  // Tasks are permanently purged after 30 days via cron
  const { error } = await supabase
    .from('tasks')
    .update({ is_archived: true, deleted_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
