import { inngest }                    from '../client'
import { createAdminClient }          from '@/lib/supabase/admin'
import { sendApprovalRequestedEmail, sendApprovalResultEmail } from '@/lib/email/send'
import { waApprovalNeeded, waApprovalResult }                  from '@/lib/whatsapp/send'

// ── When assignee submits for approval → notify manager ──────────────────
export const onApprovalRequested = inngest.createFunction(
  { id: 'on-approval-requested', name: 'Notify manager on approval request' },
  { event: 'task/approval-requested' },

  async ({ event }) => {
    const d     = event.data
    const admin = createAdminClient()

    // Get manager prefs (find manager user_id from email)
    const { data: managerUser } = await admin.from('users')
      .select('id').eq('email', d.manager_email).maybeSingle()

    const managerUserId = managerUser?.id
    let sendWA = false

    if (managerUserId) {
      const { data: prefs } = await admin.from('notification_preferences')
        .select('via_email, via_whatsapp')
        .eq('user_id', managerUserId).eq('event_type', 'task_approved').maybeSingle()
      sendWA = prefs?.via_whatsapp ?? false
    }

    // Email is always sent by default for approvals
    await sendApprovalRequestedEmail({
      to:            d.manager_email,
      taskId:        d.task_id,
      taskTitle:     d.task_title,
      submitterName: d.submitter_name,
      orgName:       d.org_name,
    })

    if (sendWA && d.manager_phone) {
      await waApprovalNeeded({
        phone:         d.manager_phone,
        managerName:   d.manager_email.split('@')[0],
        submitterName: d.submitter_name,
        taskTitle:     d.task_title,
        taskId:        d.task_id,
      })
    }

    return { notified: d.manager_email }
  }
)

// ── When manager approves/rejects → notify assignee ──────────────────────
export const onApprovalCompleted = inngest.createFunction(
  { id: 'on-approval-completed', name: 'Notify assignee on approval result' },
  { event: 'task/approval-completed' },

  async ({ event }) => {
    const d     = event.data
    const admin = createAdminClient()

    const { data: prefs } = await admin.from('notification_preferences')
      .select('via_email, via_whatsapp')
      .eq('user_id', d.assignee_id).eq('event_type', 'task_approved').maybeSingle()

    const sendEmail    = prefs?.via_email    ?? true
    const sendWhatsApp = prefs?.via_whatsapp ?? false

    if (sendEmail) {
      await sendApprovalResultEmail({
        to:           d.assignee_email,
        taskId:       d.task_id,
        taskTitle:    d.task_title,
        decision:     d.decision,
        reviewerName: d.reviewer_name,
        orgName:      d.org_name,
      })
    }

    if (sendWhatsApp && d.assignee_phone) {
      await waApprovalResult({
        phone:        d.assignee_phone,
        assigneeName: d.assignee_email.split('@')[0],
        taskTitle:    d.task_title,
        decision:     d.decision,
        reviewerName: d.reviewer_name,
        taskId:       d.task_id,
      })
    }

    return { decision: d.decision, notified: d.assignee_email }
  }
)
