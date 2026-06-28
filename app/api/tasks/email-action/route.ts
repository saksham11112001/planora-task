import { NextRequest, NextResponse } from 'next/server'
import { verifyActionToken }         from '@/lib/email/actionToken'
import { createAdminClient }         from '@/lib/supabase/admin'
import { inngest }                   from '@/lib/inngest/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

function redirect(status: 'success' | 'error' | 'already_done', action: string, taskTitle?: string) {
  const url = new URL(`${APP_URL}/task-action`)
  url.searchParams.set('status', status)
  url.searchParams.set('action', action)
  if (taskTitle) url.searchParams.set('task', taskTitle)
  return NextResponse.redirect(url.toString())
}

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t')
  if (!t) return redirect('error', 'unknown')

  let payload: ReturnType<typeof verifyActionToken>
  try {
    payload = verifyActionToken(t)
  } catch {
    return redirect('error', 'unknown')
  }

  const { taskId, userId, action } = payload
  const admin = createAdminClient()

  // Fetch task and acting user in parallel
  const [{ data: task }, { data: actor }] = await Promise.all([
    admin.from('tasks')
      .select('id, title, status, approval_status, approval_required, assignee_id, approver_id, org_id, custom_fields, parent_task_id')
      .eq('id', taskId)
      .maybeSingle(),
    admin.from('users').select('id, name, email').eq('id', userId).maybeSingle(),
  ])

  if (!task || !actor) return redirect('error', action)

  // Verify the actor is still an active member of the task's org
  const { data: membership } = await admin.from('org_members')
    .select('role').eq('user_id', userId).eq('org_id', task.org_id).eq('is_active', true).maybeSingle()
  if (!membership) return redirect('error', action)

  const isManager = ['owner', 'admin', 'manager'].includes(membership.role)
  const now       = new Date().toISOString()

  // ── COMPLETE ──────────────────────────────────────────────────────────────
  if (action === 'complete') {
    if (task.assignee_id !== userId && !isManager) return redirect('error', action, task.title)
    if (task.status === 'completed') return redirect('already_done', action, task.title)
    if (task.approval_required && task.approval_status !== 'approved' && !isManager) {
      // Should have been a submit token; redirect to app
      return NextResponse.redirect(`${APP_URL}/inbox`)
    }
    await admin.from('tasks').update({ status: 'completed', completed_at: now }).eq('id', taskId)
    return redirect('success', action, task.title)
  }

  // ── SUBMIT FOR APPROVAL ───────────────────────────────────────────────────
  if (action === 'submit') {
    if (task.assignee_id !== userId && !isManager) return redirect('error', action, task.title)
    if (task.status === 'in_review' || task.status === 'completed') {
      return redirect('already_done', action, task.title)
    }

    await admin.from('tasks')
      .update({ status: 'in_review', approval_status: 'pending' })
      .eq('id', taskId)

    // Notify approver via Inngest
    const approverId = task.approver_id
    if (approverId) {
      const { data: approver } = await admin.from('users').select('email').eq('id', approverId).maybeSingle()
      if (approver) {
        await inngest.send({
          name: 'task/approval-requested',
          data: {
            task_id:        taskId,
            task_title:     task.title,
            submitter_name: actor.name ?? actor.email,
            manager_email:  approver.email,
            org_name:       '',
          },
        })
      }
    }
    return redirect('success', action, task.title)
  }

  // ── APPROVE ───────────────────────────────────────────────────────────────
  if (action === 'approve') {
    const canApprove = isManager || task.approver_id === userId
    if (!canApprove) return redirect('error', action, task.title)
    if (task.approval_status === 'approved' || task.status === 'completed') {
      return redirect('already_done', action, task.title)
    }

    await admin.from('tasks').update({
      approval_status: 'approved',
      status:          'completed',
      approved_by:     userId,
      approved_at:     now,
      completed_at:    now,
    }).eq('id', taskId)

    // Notify assignee
    if (task.assignee_id) {
      const { data: assignee } = await admin.from('users').select('id, email').eq('id', task.assignee_id).maybeSingle()
      if (assignee) {
        const { data: org } = await admin.from('organisations').select('name').eq('id', task.org_id).maybeSingle()
        await inngest.send({
          name: 'task/approval-completed',
          data: {
            task_id:       taskId,
            task_title:    task.title,
            decision:      'approved',
            assignee_id:   assignee.id,
            assignee_email: assignee.email,
            reviewer_name: actor.name ?? actor.email,
            org_name:      org?.name ?? '',
          },
        })
      }
    }
    return redirect('success', action, task.title)
  }

  // ── REJECT ────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const canReject = isManager || task.approver_id === userId
    if (!canReject) return redirect('error', action, task.title)
    if (task.approval_status === 'rejected' || task.status === 'todo') {
      return redirect('already_done', action, task.title)
    }

    const existingCf = (task.custom_fields as Record<string, unknown>) ?? {}
    await admin.from('tasks').update({
      approval_status: 'rejected',
      status:          'todo',
      approved_by:     userId,
      approved_at:     now,
      custom_fields:   { ...existingCf, _rejection_comment: null },
    }).eq('id', taskId)

    // Notify assignee
    if (task.assignee_id) {
      const { data: assignee } = await admin.from('users').select('id, email').eq('id', task.assignee_id).maybeSingle()
      if (assignee) {
        const { data: org } = await admin.from('organisations').select('name').eq('id', task.org_id).maybeSingle()
        await inngest.send({
          name: 'task/approval-completed',
          data: {
            task_id:        taskId,
            task_title:     task.title,
            decision:       'rejected',
            assignee_id:    assignee.id,
            assignee_email: assignee.email,
            reviewer_name:  actor.name ?? actor.email,
            org_name:       org?.name ?? '',
          },
        })
      }
    }
    return redirect('success', action, task.title)
  }

  return redirect('error', action)
}
