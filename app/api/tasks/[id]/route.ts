import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
    .select('id, assignee_id, approver_id, org_id, approval_required, approval_status, status')
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

  const ALLOWED = [
    'title','description','status','priority','due_date','start_date',
    'completed_at','assignee_id','client_id','approval_status',
    'approval_required','approved_by','approved_at',
    'estimated_hours','sort_order','custom_fields',
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
