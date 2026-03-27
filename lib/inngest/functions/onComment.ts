import { inngest }                from '../client'
import { acquireEmailSlot }       from '@/lib/email/gate'
import { createAdminClient }       from '@/lib/supabase/admin'
import { sendTaskCommentedEmail }   from '@/lib/email/send'

export const onTaskCommented = inngest.createFunction(
  { id: 'on-task-commented', name: 'Notify on task comment' },
  { event: 'task/commented' },

  async ({ event }) => {
    const d     = event.data
    const admin = createAdminClient()

    // Notify task assignee (if not the commenter)
    if (!d.assignee_id || d.assignee_id === d.commenter_id) return { skipped: true }

    const { data: prefs } = await admin.from('notification_preferences')
      .select('via_email').eq('user_id', d.assignee_id).eq('event_type', 'task_commented').maybeSingle()

    if (prefs?.via_email === false) return { skipped: 'preference_off' }
    if (!(await acquireEmailSlot(d.assignee_id))) return { skipped: 'daily_limit' }
    await sendTaskCommentedEmail({
      to:            d.assignee_email,
      assigneeName:  d.assignee_name,
      commenterName: d.commenter_name,
      commentText:   d.comment_text,
      taskId:        d.task_id,
      taskTitle:     d.task_title,
      orgName:       d.org_name,
      projectId:     d.project_id ?? null,
    })

    return { notified: d.assignee_email }
  }
)
