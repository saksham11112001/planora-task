import { inngest }               from '../client'
import { createAdminClient }       from '@/lib/supabase/admin'
import { sendDueSoonEmail, sendEscalationEmail, sendApprovalDigestEmail } from '@/lib/email/send'
import { acquireEmailSlot }                        from '@/lib/email/gate'
import { waTaskDueSoon, waTaskOverdue } from '@/lib/whatsapp/send'
import { getOrgNotifMode, queueNotification } from '@/lib/email/queue'

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
          id, title, due_date, project_id, org_id,
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
        // Parse due_date as IST end-of-day (23:59 IST = 18:29 UTC) so hoursLeft
        // reflects the true deadline in IST, not UTC midnight which is 5.5h earlier.
        const dueDateISTMs = new Date(`${dueDate}T23:59:59+05:30`).getTime()
        const msLeft    = dueDateISTMs - now.getTime()
        const hoursLeft = Math.max(0, Math.round(msLeft / 3600000))

        if (sendEmail) {
          const orgName = (task.org as any)?.name ?? ''
          const orgMode = await getOrgNotifMode((task as any).org_id ?? '')
          if (orgMode === 'digest' && (task as any).org_id) {
            await queueNotification({
              orgId: (task as any).org_id, userId: assignee.id, userEmail: assignee.email,
              eventType: 'task_due_soon',
              subject: `"${task.title}" is due in ${hoursLeft}h`,
            })
            dueSoonCount++
          } else {
            const canSend = await acquireEmailSlot(assignee.id, `daily_reminder_${task.id}`)
            if (canSend) {
              await sendDueSoonEmail({
                to:           assignee.email,
                assigneeName: assignee.name,
                taskId:       task.id,
                taskTitle:    task.title,
                orgName,
                dueDate,
                hoursLeft,
                projectName:  (task.project as any)?.name ?? null,
                projectId:    task.project_id,
              })
              dueSoonCount++
            }
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

          const orgMode = await getOrgNotifMode((task as any).org_id)
          if (orgMode === 'digest') {
            await queueNotification({
              orgId: (task as any).org_id, userId: mgrUser.id, userEmail: mgrUser.email,
              eventType: 'escalation_alert',
              subject: `Overdue: "${task.title}" (assigned to ${assignee?.name ?? 'team member'})`,
            })
            escalationCount++
            continue
          }

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

        // Also notify the assignee directly that their task has been escalated
        if (assignee?.email && (await acquireEmailSlot(assignee.id, `escalation_assignee_${task.id}`))) {
          await sendEscalationEmail({
            to:           assignee.email,
            managerName:  'Your manager',
            assigneeName: assignee.name ?? 'You',
            taskId:       task.id,
            taskTitle:    task.title,
            dueDate:      task.due_date as string,
            daysOverdue:  1,
            orgName:      (task.org as any)?.name ?? '',
            projectName:  (task.project as any)?.name ?? null,
            projectId:    task.project_id,
          })
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

    // ── Step 4: Morning digest for approvers — pending approval tasks ────────
    const approverDigestCount = await step.run('approver-morning-digest', async () => {
      // Find all tasks pending approval, grouped by approver
      const { data: pendingTasks } = await admin.from('tasks')
        .select(`
          id, title, due_date, project_id, org_id,
          approver_id,
          approver:users!tasks_approver_id_fkey(id, name, email),
          assignee:users!tasks_assignee_id_fkey(id, name),
          org:organisations!inner(name)
        `)
        .eq('status', 'in_review')
        .eq('approval_status', 'pending')
        .not('approver_id', 'is', null)
        .eq('is_archived', false)
        .limit(500)

      if (!pendingTasks || pendingTasks.length === 0) return 0

      // Group by approver
      const byApprover = new Map<string, { approver: any; tasks: any[] }>()
      for (const t of pendingTasks) {
        const approver = (t as any).approver as any
        if (!approver?.email) continue
        const key = approver.id
        if (!byApprover.has(key)) byApprover.set(key, { approver, tasks: [] })
        byApprover.get(key)!.tasks.push(t)
      }

      let sent = 0
      for (const { approver, tasks } of byApprover.values()) {
        if (!(await acquireEmailSlot(approver.id, 'approver_digest'))) continue
        await sendApprovalDigestEmail({
          to:           approver.email,
          approverName: approver.name,
          orgName:      (tasks[0].org as any)?.name ?? '',
          tasks: tasks.map(t => ({
            taskId:       t.id,
            taskTitle:    t.title,
            assigneeName: (t.assignee as any)?.name ?? 'Team member',
            dueDate:      t.due_date ?? null,
            projectId:    t.project_id,
          })),
        })
        sent++
      }
      return sent
    })

    return { due_soon_count: dueSoonCount, escalation_count: escalationCount, overdue_wa_count: overdueCount, approver_digest_count: approverDigestCount }
  }
)
