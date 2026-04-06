import { createClient }     from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest }            from '@/lib/inngest/client'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

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

  const isManager  = ['owner','admin','manager'].includes(mb.role)
  const isAssignee = task.assignee_id === user.id
  const isApprover = task.approver_id
    ? task.approver_id === user.id
    : isManager

  if (!isManager && !isAssignee)
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()

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
      const { data: attachments } = await supabase
        .from('task_attachments').select('id').eq('task_id', id).limit(1)
      if (!attachments || attachments.length === 0) {
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
    // Only the designated approver can bypass this and complete directly
    if (!isApprover) {
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

  const { data, error } = await supabase
    .from('tasks').update(updates).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-complete parent when all subtasks done
  if (updates.status === 'completed' && data?.parent_task_id) {
    const { data: siblings } = await supabase
      .from('tasks').select('id, status')
      .eq('parent_task_id', data.parent_task_id)
    if (siblings?.length && siblings.every(s => s.status === 'completed')) {
      await supabase.from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', data.parent_task_id)
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
  if (!mb || !['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  // Soft delete — move to trash with deleted_at timestamp
  // Tasks are permanently purged after 30 days via cron
  const { error } = await supabase
    .from('tasks')
    .update({ is_archived: true, deleted_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
