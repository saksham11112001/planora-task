import { inngest }               from '../client'
import { createAdminClient }     from '@/lib/supabase/admin'
import { sendTaskAssignedEmail } from '@/lib/email/send'
import { waTaskAssigned }        from '@/lib/whatsapp/send'
import { getOrgNotifModeForUser, queueNotification } from '@/lib/email/queue'

export const onTaskAssigned = inngest.createFunction(
  { id: 'on-task-assigned', name: 'Notify on task assignment' },
  { event: 'task/assigned' },

  async ({ event }) => {
    const d = event.data
    const admin = createAdminClient()

    // Fetch assignee notification preferences
    const { data: prefs } = await admin.from('notification_preferences')
      .select('via_email, via_whatsapp')
      .eq('user_id', d.assignee_id)
      .eq('event_type', 'task_assigned')
      .maybeSingle()

    const sendEmail    = prefs?.via_email    ?? true
    const sendWhatsApp = prefs?.via_whatsapp ?? false

    const results: string[] = []

    if (sendEmail) {
      // Check org notification mode
      const { mode, orgId } = await getOrgNotifModeForUser(d.assignee_id)
      if (mode === 'digest' && orgId) {
        await queueNotification({
          orgId, userId: d.assignee_id, userEmail: d.assignee_email,
          eventType: 'task_assigned',
          subject: `New task assigned: ${d.task_title}${d.assigner_name ? ` (by ${d.assigner_name})` : ''}`,
        })
        results.push('queued_for_digest')
      } else {
        // Immediate mode — send every assignment email, no daily cap
        await sendTaskAssignedEmail({
          to:           d.assignee_email,
          assigneeName: d.assignee_email.split('@')[0],
          assignerName: d.assigner_name,
          taskId:       d.task_id,
          taskTitle:    d.task_title,
          orgName:      d.org_name,
          dueDate:      d.due_date,
          projectName:  d.project_name,
        })
        results.push('email_sent')
      }
    }

    if (sendWhatsApp && d.assignee_phone) {
      await waTaskAssigned({
        phone:        d.assignee_phone,
        assigneeName: d.assignee_name ?? d.assignee_email.split('@')[0],
        assignerName: d.assigner_name,
        taskTitle:    d.task_title,
        dueDate:      d.due_date,
        taskId:       d.task_id,
      })
      results.push('whatsapp_sent')
    }

    return { results }
  }
)
