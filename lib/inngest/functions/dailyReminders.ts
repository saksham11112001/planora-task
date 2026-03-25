import { inngest }            from '../client'
import { createAdminClient }  from '@/lib/supabase/admin'
import { sendDueSoonEmail }   from '@/lib/email/send'
import { waTaskDueSoon, waTaskOverdue } from '@/lib/whatsapp/send'

/**
 * Runs every day at 8:00 AM IST (2:30 AM UTC)
 * 1. Finds tasks due in the next 24 hours → sends due-soon reminders
 * 2. Finds tasks that are overdue → sends overdue reminders (once per day)
 */
export const dailyReminders = inngest.createFunction(
  {
    id:          'daily-reminders',
    name:        'Daily: due-soon + overdue reminders',
    concurrency: { limit: 1 },
  },
  { cron: '30 2 * * *' }, // 8:00 AM IST

  async ({ step }) => {
    const admin = createAdminClient()
    const now   = new Date()
    const today = now.toISOString().split('T')[0]
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // ── Step 1: Due-soon tasks (due tomorrow) ──────────────────────────
    const dueSoonResults = await step.run('fetch-due-soon-tasks', async () => {
      const { data: tasks } = await admin.from('tasks')
        .select(`
          id, title, due_date, project_id,
          assignee:users!tasks_assignee_id_fkey(id, name, email, phone_number, whatsapp_opted_in),
          project:projects(name),
          org:organisations!inner(name)
        `)
        .in('status', ['todo', 'in_progress'])
        .eq('due_date', tomorrow)
        .not('assignee_id', 'is', null)

      return tasks ?? []
    })

    for (const task of dueSoonResults) {
      await step.run(`remind-due-soon-${task.id}`, async () => {
        const assignee = (task.assignee as any)
        if (!assignee) return

        // Check preferences
        const { data: prefs } = await admin.from('notification_preferences')
          .select('via_email, via_whatsapp')
          .eq('user_id', assignee.id).eq('event_type', 'task_due_soon').maybeSingle()

        const sendEmail = prefs?.via_email ?? true
        const sendWA    = prefs?.via_whatsapp ?? false

        if (sendEmail && assignee.email) {
          await sendDueSoonEmail({
            to:           assignee.email,
            assigneeName: assignee.name,
            taskId:       task.id,
            taskTitle:    task.title,
            orgName:      (task.org as any)?.name ?? '',
            dueDate:      task.due_date,
            hoursLeft:    24,
            projectName:  (task.project as any)?.name ?? null,
            projectId:    task.project_id,
          })
        }

        if (sendWA && assignee.whatsapp_opted_in && assignee.phone_number) {
          await waTaskDueSoon({
            phone:        assignee.phone_number,
            assigneeName: assignee.name,
            taskTitle:    task.title,
            hoursLeft:    24,
            taskId:       task.id,
            projectId:    task.project_id,
          })
        }
      })
    }

    // ── Step 2: Overdue tasks ──────────────────────────────────────────
    const overdueResults = await step.run('fetch-overdue-tasks', async () => {
      const { data: tasks } = await admin.from('tasks')
        .select(`
          id, title, due_date, project_id,
          assignee:users!tasks_assignee_id_fkey(id, name, email, phone_number, whatsapp_opted_in),
          project:projects(name),
          org:organisations!inner(name)
        `)
        .in('status', ['todo', 'in_progress'])
        .lt('due_date', today)
        .not('assignee_id', 'is', null)
        .limit(200)

      return tasks ?? []
    })

    for (const task of overdueResults) {
      await step.run(`remind-overdue-${task.id}`, async () => {
        const assignee = (task.assignee as any)
        if (!assignee) return

        const { data: prefs } = await admin.from('notification_preferences')
          .select('via_email, via_whatsapp')
          .eq('user_id', assignee.id).eq('event_type', 'task_overdue').maybeSingle()

        const sendWA = prefs?.via_whatsapp ?? false

        // Overdue: WhatsApp only (email would be spammy every day)
        if (sendWA && assignee.whatsapp_opted_in && assignee.phone_number) {
          await waTaskOverdue({
            phone:        assignee.phone_number,
            assigneeName: assignee.name,
            taskTitle:    task.title,
            dueDate:      task.due_date,
            taskId:       task.id,
            projectId:    task.project_id,
          })
        }
      })
    }

    return {
      due_soon_count: dueSoonResults.length,
      overdue_count:  overdueResults.length,
    }
  }
)
