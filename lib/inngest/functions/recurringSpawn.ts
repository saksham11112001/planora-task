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
        // Create new task instance
        const { error } = await admin.from('tasks').insert({
          org_id:            tmpl.org_id,
          title:             tmpl.title,
          priority:          tmpl.priority,
          status:            'todo',
          assignee_id:       tmpl.assignee_id,
          project_id:        tmpl.project_id,
          client_id:         tmpl.client_id,
          approval_required: tmpl.approval_required,
          is_recurring:      false,             // instance is NOT a template
          parent_recurring_id: tmpl.id,         // link back to template
          due_date:          tmpl.next_occurrence_date,
          created_by:        null,
        })

        if (!error) {
          // Use granular frequency (e.g. weekly_days:mon,tue,wed,fri) for accurate advancement.
          // The DB column stores normalized values (weekly/monthly/etc.) which lose multi-day
          // and specific-day information; the granular value is preserved in custom_fields.
          const granularFreq = (tmpl as any).custom_fields?._granular_frequency || tmpl.frequency
          const nextDate = nextOccurrence(granularFreq, tmpl.next_occurrence_date)
          await admin.from('tasks')
            .update({ next_occurrence_date: nextDate })
            .eq('id', tmpl.id)
          spawned++
        } else {
          console.error(`[recurringSpawn] Failed to spawn task ${tmpl.id}:`, error.message)
        }
      })
    }

    return { templates_checked: templates.length, tasks_spawned: spawned }
  }
)
