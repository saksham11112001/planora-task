import { resend, FROM }           from './resend'
import { taskAssignedHtml, taskAssignedText }     from './templates/taskAssigned'
import { taskDueSoonHtml, taskDueSoonText }       from './templates/taskDueSoon'
import { approvalRequestedHtml, approvalResultHtml } from './templates/approvalEmail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://planora.in'

function taskUrl(taskId: string, projectId?: string | null) {
  return projectId ? `${APP_URL}/projects/${projectId}` : `${APP_URL}/inbox`
}

// ── Send task assigned email ──────────────────────────────────────────────
export async function sendTaskAssignedEmail(p: {
  to: string; assigneeName: string; assignerName: string
  taskId: string; taskTitle: string; orgName: string
  dueDate?: string | null; projectName?: string | null; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `New task assigned: ${p.taskTitle}`,
    html: taskAssignedHtml({ ...p, taskUrl: url }),
    text: taskAssignedText({ ...p, taskUrl: url }),
  })
}

// ── Send due-soon reminder email ─────────────────────────────────────────
export async function sendDueSoonEmail(p: {
  to: string; assigneeName: string; taskId: string
  taskTitle: string; orgName: string; dueDate: string
  hoursLeft: number; projectName?: string | null; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `⏰ Due soon: ${p.taskTitle}`,
    html: taskDueSoonHtml({ ...p, taskUrl: url }),
    text: taskDueSoonText({ ...p, taskUrl: url }),
  })
}

// ── Send approval requested email ────────────────────────────────────────
export async function sendApprovalRequestedEmail(p: {
  to: string; taskId: string; taskTitle: string
  submitterName: string; orgName: string; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `🔔 Approval needed: ${p.taskTitle}`,
    html: approvalRequestedHtml({ ...p, taskUrl: url }),
  })
}

// ── Send approval result email ───────────────────────────────────────────
export async function sendApprovalResultEmail(p: {
  to: string; taskId: string; taskTitle: string
  decision: 'approved' | 'rejected'; reviewerName: string
  orgName: string; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  const verb = p.decision === 'approved' ? 'Approved' : 'Rejected'
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `${p.decision === 'approved' ? '✅' : '❌'} Task ${verb}: ${p.taskTitle}`,
    html: approvalResultHtml({ ...p, taskUrl: url }),
  })
}
