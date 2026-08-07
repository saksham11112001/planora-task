import { resend, FROM }          from './resend'
// sendAppUsageEmail = product-gated send: skips recipients who signed up
// through MSME / the Partner Program. Used for every upFloat task-manager
// email below. The few sends that keep plain `resend` are marked inline.
import { sendAppUsageEmail }     from './audience'
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
import { teamInviteHtml, teamInviteText, teamInviteSubject } from './templates/teamInvite'
import { escalationAlertHtml } from './templates/escalationAlert'
import { clientDocReminderHtml, clientDocReminderSubject, clientDocReminderBatchHtml, clientDocReminderBatchSubject, type BatchProps } from './templates/clientDocReminder'
import { clientUploadNotifyHtml, clientUploadNotifySubject } from './templates/clientUploadNotify'
import { reEngagementHtml, reEngagementSubject } from './templates/reEngagementEmail'
import { onboardingNudgeHtml, onboardingNudgeSubject } from './templates/onboardingNudgeEmail'
import { upgradePushHtml, upgradePushSubject } from './templates/upgradePushEmail'
import { msmeVendorEmailHtml, msmeVendorEmailText, msmeVendorEmailSubject } from './templates/msmeVendorEmail'
import { superAdminEmails }      from '@/lib/utils/superAdmin'

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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
    from: FROM, to: p.to,
    subject: `📁 Project updated: ${p.projectName} is now ${p.newStatus.replace('_',' ')}`,
    html: projectUpdatedHtml({ ...p, projectUrl: url, memberName: p.recipientName }),
  })
}

// ── Member invited / joined ───────────────────────────────────────────────
/**
 * "You've been invited to join <org>" — sent to the INVITEE.
 *
 * Goes out over Brevo rather than Supabase's built-in SMTP, which is rate
 * limited to a handful of messages per hour. When that budget was exhausted
 * inviteUserByEmail() failed outright ("email rate limit exceeded"): no auth
 * user, no membership row, and no email — invites just silently stopped
 * working for the rest of the hour.
 *
 * NOT product-gated: this is an account/access email, in the same class as a
 * magic link. The recipient is being granted access to a workspace and must
 * always receive it, whatever product they originally signed up through.
 */
export async function sendTeamInviteEmail(p: {
  to: string; orgName: string; inviterName?: string | null
  role: string; actionUrl: string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      p.to,
    subject: teamInviteSubject(p),
    html:    teamInviteHtml(p),
    text:    teamInviteText(p),
  })
}

export async function sendMemberInvitedEmail(p: {
  to: string; recipientName: string; memberName: string
  memberEmail: string; role: string; invitedBy: string; orgName: string
}) {
  return sendAppUsageEmail({
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
  // NOT product-gated: recipients are the firm's CLIENTS, not upFloat users.
  // A client's address could coincidentally match an MSME signup, and blocking
  // their document reminders would break the CA's workflow.
  return resend.emails.send({
    from: FROM, to: p.to,
    subject: clientDocReminderSubject(p),
    html:    clientDocReminderHtml(p),
  })
}

// ── Client document reminder — batched (one email, multiple tasks) ───────────
export async function sendBatchedClientDocReminderEmail(p: BatchProps & { to: string }) {
  // NOT product-gated — external clients (see above).
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
    from: FROM, to: p.to,
    subject: `🚨 Escalation: "${p.taskTitle}" is ${p.daysOverdue} day${p.daysOverdue===1?'':'s'} overdue`,
    html: escalationAlertHtml({ ...p, taskUrl: url }),
  })
}
// ── Welcome email (sent on org creation) ─────────────────────────────────
export async function sendWelcomeEmail(p: {
  to: string; userName: string; orgName: string; trialDays?: number
}) {
  return sendAppUsageEmail({
    from: FROM, to: p.to,
    subject: welcomeEmailSubject({ userName: p.userName }),
    html:    welcomeEmailHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Day-2 follow-up email ─────────────────────────────────────────────────
export async function sendDay2Email(p: {
  to: string; userName: string; orgName: string
}) {
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
    from: FROM, to: p.to,
    subject: trialExpiringSoonSubject({ daysLeft: p.daysLeft }),
    html:    trialExpiringSoonHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── Trial expired email ───────────────────────────────────────────────────
export async function sendTrialExpiredEmail(p: {
  to: string; userName: string; orgName: string
}) {
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
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
  return sendAppUsageEmail({
    from: FROM, to: p.to,
    subject: onboardingNudgeSubject({ userName: p.userName }),
    html:    onboardingNudgeHtml({ ...p, appUrl: APP_URL }),
  })
}

// ── MSME vendor form invitation ───────────────────────────────────────────
export async function sendMsmeVendorEmail(p: {
  to: string; vendorName: string; orgName: string
  formUrl: string; unsubscribeUrl?: string | null
  attemptNo: 1 | 2 | 3 | 4 | 5; totalEmails?: number; cc?: string
  contactName?: string; contactEmail?: string; contactPhone?: string
}) {
  const msmeDomain = (process.env.FROM_EMAIL ?? 'noreply@upfloat.co').replace(/.*<|>/g, '')
  // Display name = the requesting business (e.g. "SGNG & Associates"), so the
  // vendor's inbox shows who is actually asking — not a generic product name.
  // Strip characters that could break or spoof the From header.
  const safeOrgName = p.orgName.replace(/[<>"\r\n;,]/g, '').trim().slice(0, 60) || 'MSME Compliance'
  const msmeFrom    = `${safeOrgName} <${msmeDomain}>`
  // Replies must reach a human at the requesting firm. The From address is
  // noreply@ on our domain, and a vendor's most common response to a request
  // like this is simply pressing Reply — without a Reply-To those answers
  // vanished and the vendor believed they had responded. A real Reply-To is
  // also a legitimacy signal for spam filters.
  const replyTo = p.contactEmail || p.cc
  // NOT product-gated: this is MSME's own product email, sent to the customer's
  // VENDORS (who are not upFloat users at all).
  return resend.emails.send({
    from: msmeFrom, to: p.to,
    ...(p.cc ? { cc: [p.cc] } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject: msmeVendorEmailSubject(p),
    html:    msmeVendorEmailHtml(p),
    text:    msmeVendorEmailText(p),
  })
}

// ── Payment tax invoice ───────────────────────────────────────────────────
export async function sendInvoiceEmail(p: InvoiceProps) {
  // Super admins get a blind copy of every invoice — BCC, not CC, so the
  // customer never sees internal addresses. Deduped against the visible
  // recipients so nobody is mailed twice, and skipped entirely when
  // SUPER_ADMIN_EMAIL is unset (superAdminEmails() returns []).
  const visible = new Set([p.customerEmail.toLowerCase(), 'accounts@sgng.in'])
  const bcc = superAdminEmails().filter(e => !visible.has(e))

  // NOT product-gated: a tax invoice is a financial/legal record and must
  // always reach the customer, whichever product they bought.
  return resend.emails.send({
    from:    FROM,
    to:      p.customerEmail,
    cc:      'accounts@sgng.in',
    ...(bcc.length > 0 ? { bcc } : {}),
    subject: paymentInvoiceSubject(p),
    html:    paymentInvoiceHtml(p),
  })
}

// ── Upgrade push (plan limit hit) ─────────────────────────────────────────
export async function sendUpgradePushEmail(p: {
  to: string; userName: string; orgName: string
  currentPlan: 'free' | 'starter' | 'pro'; limitHit: 'tasks' | 'members' | 'clients' | 'storage' | 'ai'
}) {
  return sendAppUsageEmail({
    from: FROM, to: p.to,
    subject: upgradePushSubject({ orgName: p.orgName, limitHit: p.limitHit }),
    html:    upgradePushHtml({ ...p, appUrl: APP_URL }),
  })
}
