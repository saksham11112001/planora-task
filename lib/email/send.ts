import { resend, FROM }           from './resend'
import { taskAssignedHtml, taskAssignedText }     from './templates/taskAssigned'
import { taskDueSoonHtml, taskDueSoonText }       from './templates/taskDueSoon'
import { approvalRequestedHtml, approvalResultHtml } from './templates/approvalEmail'
import { taskCommentedHtml }  from './templates/taskCommented'
import { projectUpdatedHtml }  from './templates/projectUpdated'
import { memberInvitedHtml }   from './templates/memberInvited'
import { escalationAlertHtml } from './templates/escalationAlert'

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


// ── Comment notification ─────────────────────────────────────────────────
export async function sendTaskCommentedEmail(p: {
  to: string; assigneeName: string; commenterName: string
  commentText: string; taskId: string; taskTitle: string
  orgName: string; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `💬 New comment on: ${p.taskTitle}`,
    html: taskCommentedHtml({ ...p, taskUrl: url }),
  })
}

// ── Project status changed ────────────────────────────────────────────────
export async function sendProjectUpdatedEmail(p: {
  to: string; recipientName: string; projectName: string
  projectId: string; oldStatus: string; newStatus: string
  updatedBy: string; orgName: string
}) {
  const url = `${APP_URL}/projects/${p.projectId}`
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `📁 Project updated: ${p.projectName} is now ${p.newStatus.replace('_',' ')}`,
    html: projectUpdatedHtml({ ...p, projectUrl: url }),
  })
}

// ── Member invited / joined ───────────────────────────────────────────────
export async function sendMemberInvitedEmail(p: {
  to: string; recipientName: string; memberName: string
  memberEmail: string; role: string; invitedBy: string; orgName: string
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `👋 ${p.memberName} joined ${p.orgName} on Planora`,
    html: memberInvitedHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Escalation alert ──────────────────────────────────────────────────────
export async function sendEscalationEmail(p: {
  to: string; managerName: string; assigneeName: string
  taskId: string; taskTitle: string; dueDate: string
  daysOverdue: number; orgName: string
  projectName?: string | null; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `🚨 Escalation: "${p.taskTitle}" is ${p.daysOverdue} day${p.daysOverdue===1?'':'s'} overdue`,
    html: escalationAlertHtml({ ...p, taskUrl: url }),
  })
}