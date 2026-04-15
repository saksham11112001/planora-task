import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

function nextOccurrence(freq: string, from: string): string {
  const d = new Date(from)

  // every_N_days (custom daily interval)
  const everyMatch = freq.match(/^every_(\d+)_days$/)
  if (everyMatch) {
    d.setDate(d.getDate() + parseInt(everyMatch[1], 10))
    return d.toISOString().split('T')[0]
  }

  // monthly_N — advance one month, set day to N
  const monthlyMatch = freq.match(/^monthly_(\d+)$/)
  if (monthlyMatch) {
    const day = parseInt(monthlyMatch[1], 10)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    return d.toISOString().split('T')[0]
  }

  // quarterly_N — advance one quarter, set day to N
  const quarterlyMatch = freq.match(/^quarterly_(\d+)$/)
  if (quarterlyMatch) {
    const day = parseInt(quarterlyMatch[1], 10)
    d.setMonth(d.getMonth() + 3)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    return d.toISOString().split('T')[0]
  }

  // annual_Nmon — advance one year, set day+month (e.g. annual_15jan)
  const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const annualMatch = freq.match(/^annual_(\d+)([a-z]+)$/)
  if (annualMatch) {
    const day   = parseInt(annualMatch[1], 10)
    const mIdx  = MONTHS_SHORT.indexOf(annualMatch[2])
    if (mIdx >= 0) {
      d.setFullYear(d.getFullYear() + 1)
      d.setMonth(mIdx)
      d.setDate(Math.min(day, new Date(d.getFullYear(), mIdx + 1, 0).getDate()))
      return d.toISOString().split('T')[0]
    }
  }

  switch (freq) {
    case 'daily':         d.setDate(d.getDate() + 1);        break
    case 'weekly':
    case 'weekly_mon':
    case 'weekly_tue':
    case 'weekly_wed':
    case 'weekly_thu':
    case 'weekly_fri':    d.setDate(d.getDate() + 7);        break
    case 'bi_weekly':     d.setDate(d.getDate() + 14);       break
    case 'monthly':
    case 'monthly_last':  d.setMonth(d.getMonth() + 1);      break
    case 'quarterly':
    case 'quarterly_last':d.setMonth(d.getMonth() + 3);      break
    case 'annual':        d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}

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
        .select('id, title, priority, assignee_id, project_id, client_id, org_id, frequency, next_occurrence_date, approval_required')
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
          // Advance next occurrence on the template
          const nextDate = nextOccurrence(tmpl.frequency, tmpl.next_occurrence_date)
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
