import { inngest }                    from '../client'
import { acquireEmailSlot }           from '@/lib/email/gate'
import { createAdminClient }          from '@/lib/supabase/admin'
import { sendApprovalRequestedEmail, sendApprovalResultEmail } from '@/lib/email/send'
import { waApprovalNeeded, waApprovalResult }                  from '@/lib/whatsapp/send'
import { getOrgNotifMode, getOrgNotifModeForUser, queueNotification } from '@/lib/email/queue'

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

    // Check org notification mode (use org_id from manager's membership)
    if (managerUserId) {
      const { data: mgMb } = await admin.from('org_members').select('org_id').eq('user_id', managerUserId).eq('is_active', true).maybeSingle()
      if (mgMb?.org_id && await getOrgNotifMode(mgMb.org_id) === 'digest') {
        await queueNotification({
          orgId: mgMb.org_id, userId: managerUserId, userEmail: d.manager_email,
          eventType: 'approval_requested',
          subject: `Approval needed: "${d.task_title}" submitted by ${d.submitter_name}`,
        })
        return { queued: true }
      }
    }

    // Email is always sent by default for approvals, but max 1 per day
    if (managerUserId && !(await acquireEmailSlot(managerUserId, 'approval_requested'))) return { skipped: 'daily_limit' }
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
      // Check org notification mode
      const { mode, orgId } = await getOrgNotifModeForUser(d.assignee_id)
      if (mode === 'digest' && orgId) {
        const verb = d.decision === 'approved' ? 'approved ✓' : 'returned ✗'
        await queueNotification({
          orgId, userId: d.assignee_id, userEmail: d.assignee_email,
          eventType: 'approval_completed',
          subject: `"${d.task_title}" was ${verb} by ${d.reviewer_name}`,
        })
        return { queued: true }
      }
      const canSend = await acquireEmailSlot(d.assignee_id, 'approval_completed')
      if (!canSend) return { skipped: 'daily_limit' }
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
