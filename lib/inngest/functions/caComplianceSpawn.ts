import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { COMPLIANCE_TASKS }  from '@/lib/data/complianceTasks'

// Build a lookup map: normalised name → subtasks
const SUBTASK_MAP = new Map(
  COMPLIANCE_TASKS.map(t => [t.title.toLowerCase().trim(), t.subtasks])
)
function findSubtasks(name: string) {
  return SUBTASK_MAP.get(name.toLowerCase().trim()) ?? []
}

/**
 * Runs every day at 7:00 AM IST (1:30 AM UTC).
 *
 * For every active CA client assignment it walks the master task's
 * `dates` JSONB object (e.g. { apr: "2026-04-13", may: "2026-05-13", … }).
 * For each month date it computes:
 *   triggerDate = dueDate − days_before_due
 *
 * If triggerDate ≤ today AND no ca_task_instances row exists for this
 * (assignment_id, due_date) pair, it:
 *   1. Creates a task in the `tasks` table (flagged _ca_compliance: true)
 *   2. Creates any compliance subtasks (flagged _compliance_subtask: true)
 *   3. Inserts a ca_task_instances row to prevent re-creation
 */
export const caComplianceSpawn = inngest.createFunction(
  {
    id:          'ca-compliance-spawn',
    name:        'Daily: spawn CA compliance tasks for clients',
    concurrency: { limit: 1 },
  },
  // Fires daily at 7:00 AM IST AND can be triggered manually from /api/ca/trigger
  [{ cron: '30 1 * * *' }, { event: 'ca/compliance-spawn-manual' }],

  async ({ step }) => {
    const admin = createAdminClient()

    // Use IST date (UTC + 5h30m) so "today" matches the business day
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const today  = nowIST.toISOString().split('T')[0]

    // ── 1. Fetch all active assignments with their master task ──────────────
    const assignments = await step.run('fetch-active-assignments', async () => {
      const { data, error } = await admin
        .from('ca_client_assignments')
        .select(`
          id, org_id, client_id, assignee_id, approver_id, created_at, start_date,
          master_task:ca_master_tasks(
            id, name, priority, dates, days_before_due
          )
        `)
        .eq('is_active', true)
      if (error) console.error('[caComplianceSpawn] fetch assignments:', error.message)
      return data ?? []
    })

    // ── 2. Build a Set of already-created (assignment_id, due_date) pairs ──
    // Scope to assignment IDs in this run — prevents a full-table scan that
    // grows O(all-time instances) as the platform scales.
    // Return an array (JSON-serializable) from step.run; convert to Set outside.
    const assignmentIds = assignments.map((a: any) => a.id)
    const existingKeysArr: string[] = await step.run('fetch-existing-instances', async () => {
      if (assignmentIds.length === 0) return []
      const { data } = await admin
        .from('ca_task_instances')
        .select('assignment_id, due_date')
        .in('assignment_id', assignmentIds)
      return (data ?? []).map((r: any) => `${r.assignment_id}__${r.due_date}`)
    })
    const existingKeys = new Set<string>(existingKeysArr)

    let spawned = 0
    let alreadyExisted = 0
    // Hard cap: Inngest recommends <1 000 steps per function run.
    // If more are needed, the next daily cron will pick up the remainder
    // (instance-key dedup ensures no double-creation).
    const MAX_STEPS_PER_RUN = 800

    // ── 3. Walk each assignment × each date ────────────────────────────────
    for (const asgn of assignments) {
      if (spawned >= MAX_STEPS_PER_RUN) break
      const master = asgn.master_task as any
      if (!master) continue

      const dates: Record<string, string> = master.dates ?? {}
      const daysBeforeDue: number         = master.days_before_due ?? 7

      // Use start_date if set (configured in Step 2), otherwise fall back to
      // created_at so that mid-year onboarding doesn't spawn all prior months.
      const startDateStr: string = (asgn as any).start_date
        ?? (asgn.created_at as string ?? '').split('T')[0]

      for (const [monthKey, dueDateStr] of Object.entries(dates)) {
        if (!dueDateStr) continue

        // Skip dates before the client's configured start date
        if (dueDateStr < startDateStr) continue

        // Compute trigger date
        const dueDate     = new Date(dueDateStr)
        const triggerDate = new Date(dueDate)
        triggerDate.setDate(triggerDate.getDate() - daysBeforeDue)
        const triggerStr = triggerDate.toISOString().split('T')[0]

        // Only spawn when trigger date has arrived
        if (triggerStr > today) continue

        // Never spawn tasks whose due date has already passed in the daily cron
        // (past tasks are handled by the manual Spawn Tasks trigger).
        if (dueDateStr < today) continue

        // Skip if already spawned for this assignment + due_date
        const instanceKey = `${asgn.id}__${dueDateStr}`
        if (existingKeys.has(instanceKey)) {
          alreadyExisted++
          continue
        }

        if (spawned >= MAX_STEPS_PER_RUN) break

        // Spawn in its own step so one failure doesn't block others
        await step.run(`spawn-${asgn.id}-${monthKey}`, async () => {
          // Create parent task
          const { data: newTask, error: taskErr } = await admin
            .from('tasks')
            .insert({
              org_id:            asgn.org_id,
              title:             master.name,
              status:            'todo',
              priority:          master.priority ?? 'medium',
              assignee_id:       asgn.assignee_id  ?? null,
              approver_id:       asgn.approver_id  ?? null,
              approval_required: !!asgn.approver_id,
              client_id:         asgn.client_id,
              due_date:          dueDateStr,
              is_recurring:      false,
              created_by:        null,
              custom_fields:     { _ca_compliance: true, _triggered: true },
            })
            .select('id')
            .single()

          if (taskErr || !newTask?.id) {
            console.error(`[caComplianceSpawn] task insert failed (${asgn.id}/${monthKey}):`, taskErr?.message)
            return
          }

          // Create subtasks for this compliance task (if defined in static data)
          const subtasks = findSubtasks(master.name)
          if (subtasks.length > 0) {
            const subtaskRows = subtasks.map(s => ({
              org_id:            asgn.org_id,
              title:             s.title,
              status:            'todo' as const,
              priority:          master.priority ?? 'medium',
              assignee_id:       asgn.assignee_id  ?? null,
              approver_id:       asgn.approver_id  ?? null,
              approval_required: !!asgn.approver_id,
              client_id:         asgn.client_id,
              due_date:          dueDateStr,
              parent_task_id:    newTask.id,
              is_recurring:      false,
              created_by:        null,
              custom_fields:     s.required ? { _compliance_subtask: true } : null,
            }))
            const { error: subErr } = await admin.from('tasks').insert(subtaskRows)
            if (subErr) {
              console.error(`[caComplianceSpawn] subtask insert failed (${asgn.id}/${monthKey}):`, subErr.message)
            }
          }

          // Record the instance — prevents re-creation on subsequent cron runs
          const { error: instErr } = await admin.from('ca_task_instances').insert({
            org_id:        asgn.org_id,
            assignment_id: asgn.id,
            task_id:       newTask.id,
            due_date:      dueDateStr,
            month_key:     monthKey,
            status:        'created',
          })
          if (instErr) {
            console.error(`[caComplianceSpawn] instance insert failed (${asgn.id}/${monthKey}):`, instErr.message)
          }

          spawned++
        })
      }
    }

    return {
      date_checked:       today,
      assignments_checked: assignments.length,
      tasks_spawned:       spawned,
      already_existed:     alreadyExisted,
    }
  }
)
