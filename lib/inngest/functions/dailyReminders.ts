import { inngest }               from '../client'
import { createAdminClient }       from '@/lib/supabase/admin'
import { sendDueSoonEmail, sendEscalationEmail } from '@/lib/email/send'
import { acquireEmailSlot }                        from '@/lib/email/gate'
import { waTaskDueSoon, waTaskOverdue } from '@/lib/whatsapp/send'

/**
 * Runs every day at 8:00 AM IST (2:30 AM UTC)
 * 1. Tasks due in 1–3 days → due-soon reminder to assignee
 * 2. Tasks overdue by exactly 1 day → escalation alert to manager
 * 3. Tasks overdue (any) → WhatsApp overdue ping to assignee (if opted in)
 */
export const dailyReminders = inngest.createFunction(
  {
    id:          'daily-reminders',
    name:        'Daily: due-soon + overdue + escalation',
    concurrency: { limit: 1 },
  },
  { cron: '30 2 * * *' }, // 8:00 AM IST

  async ({ step }) => {
    const admin = createAdminClient()
    const now   = new Date()
    const today = now.toISOString().split('T')[0]

    // Due-soon window: tasks due in 1, 2, or 3 days
    const in1day = new Date(now.getTime() + 1 * 86400000).toISOString().split('T')[0]
    const in3day = new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0]

    // Escalation window: tasks overdue by exactly 1 day
    const yesterday = new Date(now.getTime() - 1 * 86400000).toISOString().split('T')[0]

    // ── Step 1: Due-soon tasks (due in 1–3 days) ──────────────────────
    const dueSoonTasks = await step.run('fetch-due-soon-tasks', async () => {
      const { data: tasks } = await admin.from('tasks')
        .select(`
          id, title, due_date, project_id,
          assignee:users!tasks_assignee_id_fkey(id, name, email, phone_number, whatsapp_opted_in),
          project:projects(name),
          org:organisations!inner(name)
        `)
        .in('status', ['todo', 'in_progress'])
        .gte('due_date', in1day)
        .lte('due_date', in3day)
        .not('assignee_id', 'is', null)
        .eq('is_archived', false)
      return tasks ?? []
    })

    let dueSoonCount = 0
    for (const task of dueSoonTasks) {
      await step.run(`remind-due-soon-${task.id}`, async () => {
        const assignee = task.assignee as any
        if (!assignee?.email) return

        const { data: prefs } = await admin.from('notification_preferences')
          .select('via_email, via_whatsapp')
          .eq('user_id', assignee.id).eq('event_type', 'task_due_soon').maybeSingle()

        const sendEmail = prefs?.via_email    ?? true
        const sendWA    = prefs?.via_whatsapp ?? false

        const dueDate   = task.due_date as string
        const msLeft    = new Date(dueDate).getTime() - now.getTime()
        const hoursLeft = Math.max(0, Math.round(msLeft / 3600000))

        if (sendEmail) {
          const canSend = await acquireEmailSlot(assignee.id, 'daily_reminder')
          if (canSend) {
            await sendDueSoonEmail({
              to:           assignee.email,
              assigneeName: assignee.name,
              taskId:       task.id,
              taskTitle:    task.title,
              orgName:      (task.org as any)?.name ?? '',
              dueDate,
              hoursLeft,
              projectName:  (task.project as any)?.name ?? null,
              projectId:    task.project_id,
            })
            dueSoonCount++
          }
        }

        if (sendWA && assignee.whatsapp_opted_in && assignee.phone_number) {
          await waTaskDueSoon({
            phone:        assignee.phone_number,
            assigneeName: assignee.name,
            taskTitle:    task.title,
            hoursLeft,
            taskId:       task.id,
            projectId:    task.project_id,
          })
        }
      })
    }

    // ── Step 2: Escalation — tasks overdue by exactly 1 day → email manager ──
    const escalationTasks = await step.run('fetch-escalation-tasks', async () => {
      const { data: tasks } = await admin.from('tasks')
        .select(`
          id, title, due_date, project_id,
          assignee:users!tasks_assignee_id_fkey(id, name, email),
          project:projects(name),
          org:organisations!inner(name),
          org_id
        `)
        .in('status', ['todo', 'in_progress'])
        .eq('due_date', yesterday)
        .not('assignee_id', 'is', null)
        .eq('is_archived', false)
      return tasks ?? []
    })

    let escalationCount = 0
    for (const task of escalationTasks) {
      await step.run(`escalate-${task.id}`, async () => {
        const assignee = task.assignee as any

        // Find managers/owners in this org to notify
        const { data: managers } = await admin.from('org_members')
          .select('user_id, users(id, name, email)')
          .eq('org_id', (task as any).org_id)
          .in('role', ['owner', 'admin', 'manager'])
          .eq('is_active', true)

        if (!managers?.length) return

        for (const mgr of managers) {
          const mgrUser = (mgr.users as any)
          if (!mgrUser?.email) continue

          // Don't escalate to themselves if manager is also the assignee
          if (mgrUser.id === assignee?.id) continue

          if (!(await acquireEmailSlot(mgrUser.id, 'escalation_alert'))) continue
          await sendEscalationEmail({
            to:           mgrUser.email,
            managerName:  mgrUser.name,
            assigneeName: assignee?.name ?? 'Team member',
            taskId:       task.id,
            taskTitle:    task.title,
            dueDate:      task.due_date as string,
            daysOverdue:  1,
            orgName:      (task.org as any)?.name ?? '',
            projectName:  (task.project as any)?.name ?? null,
            projectId:    task.project_id,
          })
          escalationCount++
        }
      })
    }

    // ── Step 3: General overdue → WhatsApp ping to assignee ──────────────
    const overdueTasks = await step.run('fetch-overdue-tasks', async () => {
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
        .eq('is_archived', false)
        .limit(200)
      return tasks ?? []
    })

    let overdueCount = 0
    for (const task of overdueTasks) {
      await step.run(`overdue-wa-${task.id}`, async () => {
        const assignee = task.assignee as any
        if (!assignee) return

        const { data: prefs } = await admin.from('notification_preferences')
          .select('via_whatsapp')
          .eq('user_id', assignee.id).eq('event_type', 'task_overdue').maybeSingle()

        if ((prefs?.via_whatsapp ?? false) && assignee.whatsapp_opted_in && assignee.phone_number) {
          await waTaskOverdue({
            phone:        assignee.phone_number,
            assigneeName: assignee.name,
            taskTitle:    task.title,
            dueDate:      task.due_date as string,
            taskId:       task.id,
            projectId:    task.project_id,
          })
          overdueCount++
        }
      })
    }

    return { due_soon_count: dueSoonCount, escalation_count: escalationCount, overdue_wa_count: overdueCount }
  }
)
