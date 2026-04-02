export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { decision } = await req.json()

  if (!['submit', 'approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  // Fetch the task
  const { data: task } = await supabase
    .from('tasks')
    .select('*, org_id, approver_id, assignee_id, title')
    .eq('id', id)
    .maybeSingle()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Get org member info for permission check
  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', task.org_id)
    .maybeSingle()

  const canManage = member && ['admin', 'manager'].includes(member.role)

  let newStatus: string
  let newApprovalStatus: string
  let inngestEvent: string | null = null

  if (decision === 'submit') {
    // Assignee submits for approval
    if (task.assignee_id !== user.id && !canManage) {
      return NextResponse.json({ error: 'Only assignee can submit for approval' }, { status: 403 })
    }
    newStatus = 'in_review'
    newApprovalStatus = 'pending'
    inngestEvent = 'task/submitted-for-approval'
  } else if (decision === 'approve') {
    // CRITICAL: map 'approve' → 'approved' before storing
    if (!canManage && task.approver_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to approve' }, { status: 403 })
    }
    newStatus = 'completed'
    newApprovalStatus = 'approved'   // ← mapped from 'approve'
    inngestEvent = 'task/approved'
  } else {
    // reject → 'rejected'
    if (!canManage && task.approver_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to reject' }, { status: 403 })
    }
    newStatus = 'todo'
    newApprovalStatus = 'rejected'   // ← mapped from 'reject'
    inngestEvent = 'task/rejected'
  }

  // Update task
  const { data: updated, error } = await supabase
    .from('tasks')
    .update({
      status: newStatus,
      approval_status: newApprovalStatus,
      ...(decision === 'approve' || decision === 'reject'
        ? { approved_by: user.id, approved_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire Inngest event
  if (inngestEvent) {
    try {
      await inngest.send({
        name: inngestEvent,
        data: {
          task_id: id,
          org_id: task.org_id,
          decision: newApprovalStatus,  // already mapped
          acted_by: user.id,
          assignee_id: task.assignee_id,
          approver_id: task.approver_id,
          task_title: task.title,
        },
      })
    } catch (e) {
      console.error('Inngest send failed (non-fatal):', e)
    }
  }

  return NextResponse.json(updated)
}
