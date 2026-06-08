import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

export const monthlyDocReminders = inngest.createFunction(
  { id: 'monthly-doc-reminders', name: 'Monthly Document Request Reminders' },
  { cron: '0 9 1 * *' },
  async ({ step }) => {
    const admin = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    // Find orgs with CA compliance enabled
    const orgSettings = await step.run('fetch-ca-orgs', async () => {
      const { data } = await admin
        .from('org_settings')
        .select('org_id')
        .contains('nav_features', { ca_compliance_mode: true })
      return data
    })

    if (!orgSettings?.length) return { sent: 0 }

    let totalSent = 0

    for (const { org_id } of orgSettings) {
      const sent = await step.run(`process-org-${org_id}`, async () => {
        // Get open CA tasks due in next 7 days
        const { data: tasks } = await admin
          .from('tasks')
          .select('id, title, due_date, client_id')
          .eq('org_id', org_id)
          .contains('custom_fields', { _ca_compliance: true })
          .not('status', 'in', '("completed","cancelled")')
          .neq('is_archived', true)
          .not('due_date', 'is', null)
          .lte('due_date', in7days)
          .gte('due_date', today)

        if (!tasks?.length) return 0

        // Find tasks with no attachments
        const taskIds = tasks.map(t => t.id)
        const { data: attachments } = await admin
          .from('task_attachments')
          .select('task_id')
          .in('task_id', taskIds)

        const attachedIds = new Set((attachments ?? []).map(a => a.task_id))
        const unattachedTasks = tasks.filter(t => !attachedIds.has(t.id))

        if (!unattachedTasks.length) return 0

        // Group by client
        const byClient: Record<string, typeof unattachedTasks> = {}
        unattachedTasks.forEach(t => {
          if (!t.client_id) return
          if (!byClient[t.client_id]) byClient[t.client_id] = []
          byClient[t.client_id].push(t)
        })

        // Get client emails
        const clientIds = Object.keys(byClient)
        const { data: clients } = await admin
          .from('clients')
          .select('id, name, email, phone')
          .in('id', clientIds)

        // Queue notifications for assignees (log to notification_queue or send email)
        let count = 0
        for (const client of clients ?? []) {
          const clientTasks = byClient[client.id]
          if (!clientTasks?.length) continue
          // Insert into notification_queue for each task
          for (const task of clientTasks) {
            await admin.from('notification_queue').insert({
              org_id,
              type: 'doc_reminder',
              payload: {
                task_id: task.id,
                task_title: task.title,
                client_id: client.id,
                client_name: client.name,
                client_email: client.email,
                due_date: task.due_date,
              },
              scheduled_for: new Date().toISOString(),
            }).catch(() => {}) // non-fatal if queue doesn't exist
          }
          count++
        }
        return count
      })
      totalSent += sent
    }

    return { sent: totalSent }
  }
)
