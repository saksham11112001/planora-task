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
    // Use IST date (UTC+5:30) so spawning aligns with the business day at cron time (7 AM IST = 1:30 AM UTC)
    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const today = todayIST.toISOString().split('T')[0]

    // One step is spent per template below, and Inngest starts refusing work
    // around a thousand, so this stays a bounded slice rather than everything
    // due. Templates are ordered oldest-first so a backlog drains in order
    // instead of the same rows being served every morning.
    const TEMPLATE_LIMIT = 500

    const templates = await step.run('fetch-due-recurring-templates', async () => {
      // The error was previously not even destructured. A failed read handed
      // back null, became [], and the run finished reporting
      // "templates_checked: 0" — indistinguishable from "nothing was due".
      // That is precisely how the CA spawner went ten days creating nothing
      // while looking healthy. Throwing fails the run, which is what the
      // job-failure alert watches.
      const { data, error } = await admin.from('tasks')
        .select('id, title, priority, assignee_id, project_id, client_id, org_id, frequency, next_occurrence_date, approval_required, custom_fields')
        .eq('is_recurring', true)
        .lte('next_occurrence_date', today)
        .neq('is_archived', true)
        .order('next_occurrence_date', { ascending: true })
        .limit(TEMPLATE_LIMIT)
      if (error) {
        console.error('[recurringSpawn] fetch due templates:', error.message)
        throw new Error(`Could not read due recurring templates: ${error.message}`)
      }
      return data ?? []
    })

    // Hitting the cap means there was more due than we took. Silence here is
    // the same lie in a different shape — the overflow would simply never be
    // spawned, with nothing in the result to say so. It is reported below and
    // drains on the next run, because the slice is ordered by due date.
    const capped = templates.length >= TEMPLATE_LIMIT
    if (capped) {
      console.warn(`[recurringSpawn] hit the ${TEMPLATE_LIMIT}-template ceiling — the remainder spawns on the next run`)
    }

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

    return { templates_checked: templates.length, tasks_spawned: spawned, capped }
  }
)
