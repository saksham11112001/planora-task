import { NextRequest, NextResponse } from 'next/server'
import { verifyActionToken }         from '@/lib/email/actionToken'
import { createAdminClient }         from '@/lib/supabase/admin'
import { inngest }                   from '@/lib/inngest/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

const ACTION_LABEL: Record<string, string> = {
  complete: 'Mark complete',
  submit:   'Submit for approval',
  approve:  'Approve',
  reject:   'Reject',
}

const ACTION_QUESTION: Record<string, string> = {
  complete: 'Mark this task complete?',
  submit:   'Submit this task for approval?',
  approve:  'Approve this task?',
  reject:   'Return this task to the assignee?',
}

function redirect(status: 'success' | 'error' | 'already_done', action: string, taskTitle?: string) {
  const url = new URL(`${APP_URL}/task-action`)
  url.searchParams.set('status', status)
  url.searchParams.set('action', action)
  if (taskTitle) url.searchParams.set('task', taskTitle)
  // 303, not the default 307. A 307 preserves the method, so the browser would
  // re-POST to the result page (which only handles GET) and land on a 405.
  // 303 See Other is the correct answer to a form submission and behaves
  // identically for the GET callers.
  return NextResponse.redirect(url.toString(), 303)
}

/**
 * Carry out the action. Only ever reached from POST — see the note on GET.
 */
async function performAction(payload: ReturnType<typeof verifyActionToken>) {
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
      return NextResponse.redirect(`${APP_URL}/inbox`, 303)
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

// ── HTML escaping ────────────────────────────────────────────────────────────
// The task title is rendered into the confirmation page below. It is user-typed
// text from inside the app, so it goes through here before it touches HTML.
function esc(s: string) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function confirmPage(token: string, action: string, taskTitle: string) {
  const question = ACTION_QUESTION[action] ?? 'Confirm this action?'
  const label    = ACTION_LABEL[action]    ?? 'Confirm'
  const danger   = action === 'reject'
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(label)} — upFloat</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px 16px">
  <div style="max-width:480px;width:100%;background:#fff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.07);padding:40px 32px;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">${danger ? '&#8617;&#65039;' : '&#10004;&#65039;'}</div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">${esc(question)}</h1>
    <div style="margin:16px 0;padding:12px 16px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;font-size:14px;color:#0f172a;font-weight:600">${esc(taskTitle)}</div>
    <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6">Nothing has changed yet. This takes effect only when you press the button below.</p>
    <form method="POST" action="/api/tasks/email-action">
      <input type="hidden" name="t" value="${esc(token)}">
      <button type="submit" style="width:100%;padding:13px 20px;border:0;border-radius:10px;background:${danger ? '#dc2626' : '#0d9488'};color:#fff;font-size:15px;font-weight:600;cursor:pointer">${esc(label)}</button>
    </form>
    <a href="${APP_URL}/tasks" style="display:inline-block;margin-top:16px;font-size:14px;color:#64748b;text-decoration:none">Open upFloat instead</a>
  </div>
</body></html>`
}

/**
 * GET — SHOWS a confirmation page. It must never change anything.
 *
 * This used to perform the action directly. A GET is expected to be safe to
 * repeat, and everything on the internet treats it that way: mail security
 * scanners (Defender Safe Links, Mimecast, Proofpoint), link previewers and
 * browser prefetchers all fetch every URL in a message to vet it. Each of
 * those fetches completed a task, so tasks finished themselves overnight with
 * nobody having clicked anything — and because the daily reminder sends one
 * email per due task, a single scan could sweep a whole morning's batch.
 *
 * A scanner will happily fetch this page. It will not submit the form, so the
 * action now needs a real person. The write lives in POST.
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t')
  if (!t) return redirect('error', 'unknown')

  let payload: ReturnType<typeof verifyActionToken>
  try { payload = verifyActionToken(t) } catch { return redirect('error', 'unknown') }

  // Read-only: fetch the title so the page can say WHICH task is affected.
  const admin = createAdminClient()
  const { data: task } = await admin.from('tasks')
    .select('id, title, status, approval_status')
    .eq('id', payload.taskId)
    .maybeSingle()

  if (!task) return redirect('error', payload.action)

  // If it is already in the target state, say so rather than offering a button
  // that would do nothing. Mirrors the checks in performAction.
  const done =
    (payload.action === 'complete' && task.status === 'completed') ||
    (payload.action === 'submit'   && (task.status === 'in_review' || task.status === 'completed')) ||
    (payload.action === 'approve'  && (task.approval_status === 'approved' || task.status === 'completed')) ||
    (payload.action === 'reject'   && (task.approval_status === 'rejected' || task.status === 'todo'))
  if (done) return redirect('already_done', payload.action, task.title)

  return new NextResponse(confirmPage(t, payload.action, task.title), {
    status: 200,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag':  'noindex, nofollow',
    },
  })
}

/**
 * POST — performs the action. Reached only by submitting the form above.
 */
export async function POST(req: NextRequest) {
  let token = req.nextUrl.searchParams.get('t') ?? ''
  if (!token) {
    try {
      const form = await req.formData()
      token = String(form.get('t') ?? '')
    } catch { /* no form body */ }
  }
  if (!token) return redirect('error', 'unknown')

  let payload: ReturnType<typeof verifyActionToken>
  try { payload = verifyActionToken(token) } catch { return redirect('error', 'unknown') }

  return performAction(payload)
}
