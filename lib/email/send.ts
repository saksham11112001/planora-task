import { resend, FROM }           from './resend'
import { generateActionToken }   from './actionToken'
import { welcomeEmailHtml, welcomeEmailSubject, day2EmailHtml, day2EmailSubject } from './templates/welcomeEmail'
import { trialExpiringSoonHtml, trialExpiringSoonSubject, trialExpiredHtml, trialExpiredSubject } from './templates/trialEmail'
import { taskAssignedHtml, taskAssignedText }     from './templates/taskAssigned'
import { taskDueSoonHtml, taskDueSoonText }       from './templates/taskDueSoon'
import { paymentInvoiceHtml, paymentInvoiceSubject, type InvoiceProps } from './templates/paymentInvoice'
import { approvalRequestedHtml, approvalResultHtml } from './templates/approvalEmail'
import { approvalDigestHtml } from './templates/approvalDigest'
import { taskCommentedHtml }  from './templates/taskCommented'
import { projectUpdatedHtml }  from './templates/projectUpdated'
import { memberInvitedHtml }   from './templates/memberInvited'
import { escalationAlertHtml } from './templates/escalationAlert'
import { clientDocReminderHtml, clientDocReminderSubject, clientDocReminderBatchHtml, clientDocReminderBatchSubject, type BatchProps } from './templates/clientDocReminder'
import { clientUploadNotifyHtml, clientUploadNotifySubject } from './templates/clientUploadNotify'
import { reEngagementHtml, reEngagementSubject } from './templates/reEngagementEmail'
import { onboardingNudgeHtml, onboardingNudgeSubject } from './templates/onboardingNudgeEmail'
import { upgradePushHtml, upgradePushSubject } from './templates/upgradePushEmail'
import { msmeVendorEmailHtml, msmeVendorEmailSubject } from './templates/msmeVendorEmail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

function taskUrl(taskId: string, projectId?: string | null) {
  return projectId ? `${APP_URL}/projects/${projectId}` : `${APP_URL}/inbox`
}

function actionUrl(taskId: string, userId: string, action: Parameters<typeof generateActionToken>[2]) {
  const token = generateActionToken(taskId, userId, action)
  return `${APP_URL}/api/tasks/email-action?t=${token}`
}

// ── Send task assigned email ──────────────────────────────────────────────
export async function sendTaskAssignedEmail(p: {
  to: string; assigneeName: string; assignerName: string
  taskId: string; taskTitle: string; orgName: string
  dueDate?: string | null; projectName?: string | null; projectId?: string | null
  assigneeUserId?: string | null; approvalRequired?: boolean | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  let aUrl: string | null = null
  let aLabel: string | null = null
  if (p.assigneeUserId) {
    const act = p.approvalRequired ? 'submit' : 'complete'
    aUrl   = actionUrl(p.taskId, p.assigneeUserId, act)
    aLabel = p.approvalRequired ? 'Submit for Approval' : 'Mark Complete'
  }
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `New task assigned: ${p.taskTitle}`,
    html: taskAssignedHtml({ ...p, taskUrl: url, actionUrl: aUrl, actionLabel: aLabel }),
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
  managerUserId?: string | null
}) {
  const url        = taskUrl(p.taskId, p.projectId)
  const approveUrl = p.managerUserId ? actionUrl(p.taskId, p.managerUserId, 'approve') : null
  const rejectUrl  = p.managerUserId ? actionUrl(p.taskId, p.managerUserId, 'reject')  : null
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `🔔 Approval needed: ${p.taskTitle}`,
    html: approvalRequestedHtml({ ...p, taskUrl: url, approveUrl, rejectUrl }),
  })
}

// ── Send approval result email ───────────────────────────────────────────
export async function sendApprovalResultEmail(p: {
  to: string; taskId: string; taskTitle: string
  decision: 'approved' | 'rejected'; reviewerName: string
  orgName: string; projectId?: string | null; rejectionComment?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  const verb = p.decision === 'approved' ? 'Approved' : 'Rejected'
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `${p.decision === 'approved' ? '✅' : '❌'} Task ${verb}: ${p.taskTitle}`,
    html: approvalResultHtml({ ...p, taskUrl: url }),
  })
}


// ── Approver morning digest ───────────────────────────────────────────────
export async function sendApprovalDigestEmail(p: {
  to: string; approverName: string; orgName: string
  tasks: { taskId: string; taskTitle: string; assigneeName: string; dueDate?: string | null; projectId?: string | null }[]
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `🔔 ${p.tasks.length} task${p.tasks.length !== 1 ? 's' : ''} waiting for your approval — ${p.orgName}`,
    html: approvalDigestHtml(p),
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
    html: projectUpdatedHtml({ ...p, projectUrl: url, memberName: p.recipientName }),
  })
}

// ── Member invited / joined ───────────────────────────────────────────────
export async function sendMemberInvitedEmail(p: {
  to: string; recipientName: string; memberName: string
  memberEmail: string; role: string; invitedBy: string; orgName: string
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: `👋 ${p.memberName} joined ${p.orgName} on upFloat`,
    html: memberInvitedHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Client document reminder ─────────────────────────────────────────────────
export async function sendClientDocReminderEmail(p: {
  to: string; clientName: string; orgName: string
  taskTitle: string; dueDate: string; collectionDeadline: string
  daysLeft: number; portalUrl: string; missingDocs: string[]
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: clientDocReminderSubject(p),
    html:    clientDocReminderHtml(p),
  })
}

// ── Client document reminder — batched (one email, multiple tasks) ───────────
export async function sendBatchedClientDocReminderEmail(p: BatchProps & { to: string }) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: clientDocReminderBatchSubject(p),
    html:    clientDocReminderBatchHtml(p),
  })
}

// ── CA assignee upload notification ──────────────────────────────────────────
export async function sendClientUploadNotifyEmail(p: {
  to: string; assigneeName: string; clientName: string; orgName: string
  taskTitle: string; docTypeName: string; periodKey: string
  fileName: string; taskId: string; projectId?: string | null
}) {
  const url = taskUrl(p.taskId, p.projectId)
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: clientUploadNotifySubject({ ...p, taskUrl: url }),
    html:    clientUploadNotifyHtml({ ...p, taskUrl: url }),
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
// ── Welcome email (sent on org creation) ─────────────────────────────────
export async function sendWelcomeEmail(p: {
  to: string; userName: string; orgName: string; trialDays?: number
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: welcomeEmailSubject({ userName: p.userName }),
    html:    welcomeEmailHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Day-2 follow-up email ─────────────────────────────────────────────────
export async function sendDay2Email(p: {
  to: string; userName: string; orgName: string
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: day2EmailSubject(),
    html:    day2EmailHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Trial expiring soon email ─────────────────────────────────────────────
export async function sendTrialExpiringSoonEmail(p: {
  to: string; userName: string; orgName: string
  trialEndsAt: string; daysLeft: number
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: trialExpiringSoonSubject({ daysLeft: p.daysLeft }),
    html:    trialExpiringSoonHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Trial expired email ───────────────────────────────────────────────────
export async function sendTrialExpiredEmail(p: {
  to: string; userName: string; orgName: string
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: trialExpiredSubject(),
    html:    trialExpiredHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Re-engagement email ───────────────────────────────────────────────────
export async function sendReEngagementEmail(p: {
  to: string; userName: string; orgName: string; daysSince: number
  overdueCount: number; pendingCount: number
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: reEngagementSubject({ userName: p.userName, overdueCount: p.overdueCount }),
    html:    reEngagementHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Onboarding nudge (setup checklist) ────────────────────────────────────
export async function sendOnboardingNudgeEmail(p: {
  to: string; userName: string; orgName: string
  hasClient: boolean; hasTask: boolean; hasTeam: boolean; hasCa: boolean
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: onboardingNudgeSubject({ userName: p.userName }),
    html:    onboardingNudgeHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── MSME vendor form invitation ───────────────────────────────────────────
export async function sendMsmeVendorEmail(p: {
  to: string; vendorName: string; orgName: string
  formUrl: string; attemptNo: 1 | 2 | 3 | 4 | 5; totalEmails?: number; cc?: string
  contactName?: string; contactEmail?: string; contactPhone?: string
}) {
  const msmeDomain = (process.env.FROM_EMAIL ?? 'noreply@upfloat.co').replace(/.*<|>/g, '')
  const msmeFrom   = `MSME Compliance <${msmeDomain}>`
  return resend.emails.send({
    from: msmeFrom, to: p.to,
    ...(p.cc ? { cc: [p.cc] } : {}),
    subject: msmeVendorEmailSubject(p),
    html:    msmeVendorEmailHtml(p),
  })
}

// ── Payment tax invoice ───────────────────────────────────────────────────
export async function sendInvoiceEmail(p: InvoiceProps) {
  return resend.emails.send({
    from:    FROM,
    to:      p.customerEmail,
    cc:      'accounts@sgng.in',
    subject: paymentInvoiceSubject(p),
    html:    paymentInvoiceHtml(p),
  })
}

// ── Upgrade push (plan limit hit) ─────────────────────────────────────────
export async function sendUpgradePushEmail(p: {
  to: string; userName: string; orgName: string
  currentPlan: 'free' | 'starter' | 'pro'; limitHit: 'tasks' | 'members' | 'clients' | 'storage' | 'ai'
}) {
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: upgradePushSubject({ orgName: p.orgName, limitHit: p.limitHit }),
    html:    upgradePushHtml({ ...p, appUrl: APP_URL }),
  })
}
