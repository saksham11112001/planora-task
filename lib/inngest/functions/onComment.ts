import { inngest }                from '../client'
import { acquireEmailSlot }       from '@/lib/email/gate'
import { createAdminClient }       from '@/lib/supabase/admin'
import { sendTaskCommentedEmail }   from '@/lib/email/send'
import { getOrgNotifModeForUser, queueNotification } from '@/lib/email/queue'

export const onTaskCommented = inngest.createFunction(
  { id: 'on-task-commented', name: 'Notify on task comment' },
  { event: 'task/commented' },

  async ({ event }) => {
    const d     = event.data
    const admin = createAdminClient()

    // Fetch task creator and approver so they can be notified alongside the assignee
    const { data: task } = await admin.from('tasks')
      .select('creator:users!tasks_created_by_fkey(id, name, email), approver:users!tasks_approver_id_fkey(id, name, email)')
      .eq('id', d.task_id)
      .maybeSingle()

    // Build deduplicated recipient list: assignee + creator + approver, excluding commenter
    type Recipient = { id: string; name: string; email: string }
    const seen = new Set<string>([d.commenter_id])
    const recipients: Recipient[] = []

    const add = (r: any) => {
      if (!r?.id || !r?.email || seen.has(r.id)) return
      seen.add(r.id)
      recipients.push(r as Recipient)
    }

    if (d.assignee_id) add({ id: d.assignee_id, name: d.assignee_name, email: d.assignee_email })
    if (task) {
      add((task as any).creator)
      add((task as any).approver)
    }

    if (!recipients.length) return { skipped: true }

    let notified = 0
    for (const recipient of recipients) {
      const { data: prefs } = await admin.from('notification_preferences')
        .select('via_email').eq('user_id', recipient.id).eq('event_type', 'task_commented').maybeSingle()
      if (prefs?.via_email === false) continue

      const { mode, orgId } = await getOrgNotifModeForUser(recipient.id)
      if (mode === 'digest' && orgId) {
        await queueNotification({
          orgId, userId: recipient.id, userEmail: recipient.email,
          eventType: 'task_commented',
          subject: `New comment on "${d.task_title}" by ${d.commenter_name}`,
        })
        notified++
        continue
      }

      if (!(await acquireEmailSlot(recipient.id, 'task_commented'))) continue
      await sendTaskCommentedEmail({
        to:            recipient.email,
        assigneeName:  recipient.name,
        commenterName: d.commenter_name,
        commentText:   d.comment_text,
        taskId:        d.task_id,
        taskTitle:     d.task_title,
        orgName:       d.org_name,
        projectId:     d.project_id ?? null,
      })
      notified++
    }

    return { notified }
  }
)
