import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextOccurrence }    from '@/lib/utils/recurringSchedule'

/**
 * Runs every day at 7:00 AM IST (1:30 AM UTC)
 * Finds recurring task templates whose next_occurrence_date is today or earlier,
 * spawns a new task instance, then advances next_occurrence_date.
 */
export const recurringSpawn = inngest.createFunction(
  {
    id:          'recurring-spawn',
    name:        'Daily: spawn recurring task instances',
    concurrency: { limit: 1 },
  },
  { cron: '30 1 * * *' }, // 7:00 AM IST

  async ({ step }) => {
    const admin = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const templates = await step.run('fetch-due-recurring-templates', async () => {
      const { data } = await admin.from('tasks')
        .select('id, title, priority, assignee_id, project_id, client_id, org_id, frequency, next_occurrence_date, approval_required, custom_fields')
        .eq('is_recurring', true)
        .lte('next_occurrence_date', today)
        .neq('is_archived', true)
        .limit(500)
      return data ?? []
    })

    let spawned = 0

    for (const tmpl of templates) {
      await step.run(`spawn-${tmpl.id}`, async () => {
        const granularFreq = (tmpl as any).custom_fields?._granular_frequency || tmpl.frequency
        const spawnDate    = tmpl.next_occurrence_date

        // Guard: if an instance already exists for this template + date, skip insert.
        // This makes the step idempotent so Inngest retries don't create duplicates.
        const { data: existing } = await admin.from('tasks')
          .select('id')
          .eq('parent_recurring_id', tmpl.id)
          .eq('due_date', spawnDate)
          .maybeSingle()

        if (!existing) {
          const { error } = await admin.from('tasks').insert({
            org_id:              tmpl.org_id,
            title:               tmpl.title,
            priority:            tmpl.priority,
            status:              'todo',
            assignee_id:         tmpl.assignee_id,
            project_id:          tmpl.project_id,
            client_id:           tmpl.client_id,
            approval_required:   tmpl.approval_required,
            is_recurring:        false,
            parent_recurring_id: tmpl.id,
            due_date:            spawnDate,
            created_by:          null,
          })
          if (error) {
            console.error(`[recurringSpawn] Failed to spawn task ${tmpl.id}:`, error.message)
            return
          }
          spawned++
        }

        // Always advance next_occurrence_date (idempotent — safe to re-run)
        const nextDate = nextOccurrence(granularFreq, spawnDate)
        await admin.from('tasks')
          .update({ next_occurrence_date: nextDate })
          .eq('id', tmpl.id)
      })
    }

    return { templates_checked: templates.length, tasks_spawned: spawned }
  }
)
