import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { shiftDays }         from '@/lib/utils/recurringSchedule'
import { fetchAllRows, chunk } from '@/lib/supabase/fetchAll'

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
 *   2. Inserts a ca_task_instances row to prevent re-creation
 * Attachment headers are surfaced as a checklist in the task detail panel — not as subtasks.
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

    // Use IST date (UTC + 5h30m) so "today" matches the business day.
    // Resolved inside a step so it is memoised: the spawn batches below are
    // addressed by position, so a replay that crossed midnight would otherwise
    // plan different work than the batch ids already stand for.
    const today: string = await step.run('resolve-today-ist', async () =>
      new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0])

    // ── 1. Fetch all active assignments with their master task ──────────────
    // Paged. This is a platform-wide cron, so the row count is every firm's
    // assignments added together — far past PostgREST's max-rows, which
    // truncates without an error. The tail of that list was never processed, so
    // whole firms' clients silently never had their compliance tasks created.
    const assignments = await step.run('fetch-active-assignments', async () => {
      const { data, error } = await fetchAllRows<any>(
        (from, to) => admin
          .from('ca_client_assignments')
          .select(`
            id, org_id, client_id, assignee_id, approver_id, created_at, start_date, end_date,
            master_task:ca_master_tasks(
              id, name, priority, dates, days_before_due
              { maxRows: 20_000 },
            )
          `)
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(from, to),
      )
      if (error) console.error('[caComplianceSpawn] fetch assignments:', (error as any)?.message)
      return data
    })

    // ── 2. Build a Set of already-created (assignment_id, due_date) pairs ──
    // Scope to assignment IDs in this run — prevents a full-table scan that
    // grows O(all-time instances) as the platform scales.
    // Return an array (JSON-serializable) from step.run; convert to Set outside.
    const assignmentIds = assignments.map((a: any) => a.id)
    const existingKeysArr: string[] = await step.run('fetch-existing-instances', async () => {
      if (assignmentIds.length === 0) return []
      // Chunked and paged: a few thousand UUIDs in one `.in()` overruns the URL
      // length limit and returns 414, which looks like "nothing spawned yet" to
      // the caller. The job then retried work it had already done and spent its
      // whole budget being rejected by the unique constraint.
      const keys: string[] = []
      for (const ids of chunk(assignmentIds)) {
        const { data, error } = await fetchAllRows<any>(
          (from, to) => admin
            .from('ca_task_instances')
            .select('assignment_id, due_date')
            .in('assignment_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
          { maxRows: 20_000 },
        )
        if (error) {
          // A partial dedup set would cause duplicate spawn attempts, so stop.
          console.error('[caComplianceSpawn] fetch instances:', (error as any)?.message)
          throw new Error('Could not read existing CA task instances')
        }
        for (const r of data) keys.push(`${r.assignment_id}__${r.due_date}`)
      }
      return keys
    })
    const existingKeys = new Set<string>(existingKeysArr)

    let alreadyExisted = 0

    // Inngest recommends staying under ~1000 steps per run, so the work is
    // planned first and then executed in batches. The old code counted spawns
    // inside step.run and compared that counter to the cap — but Inngest replays
    // the function after every step and memoised steps do not re-run their
    // callback, so the counter reset to 0 on each replay and the cap could never
    // fire. A large firm therefore blew past the step budget and the run died
    // partway through, leaving every assignment after that point unspawned. The
    // same clients were served first every day, so the rest never caught up.
    const MAX_SPAWNS_PER_RUN = 800
    const SPAWNS_PER_STEP    = 25

    type SpawnJob = {
      assignmentId: string; orgId: string; clientId: string
      assigneeId: string | null; approverId: string | null
      title: string; priority: string; dueDate: string; monthKey: string
    }

    // ── 3. Plan: walk each assignment × each date, no steps, no side effects ──
    const jobs: SpawnJob[] = []
    let deferred = 0

    for (const asgn of assignments) {
      const master = asgn.master_task as any
      if (!master) continue

      const dates: Record<string, string> = master.dates ?? {}
      const daysBeforeDue: number         = master.days_before_due ?? 7

      // Use start_date if set (configured in Step 2), otherwise fall back to
      // created_at so that mid-year onboarding doesn't spawn all prior months.
      const startDateStr: string = (asgn as any).start_date
        ?? (asgn.created_at as string ?? '').split('T')[0]

      // Upper bound, set in Step 2 when a firm is winding a client down. NULL
      // means open-ended, which is every existing assignment, so this changes
      // nothing until someone actually sets a date. Inclusive, mirroring
      // start_date: end_date = 2026-07-31 keeps the obligation due that day and
      // stops everything after it — which is the whole point, since the next
      // financial year's dates would otherwise start spawning as usual.
      const endDateStr: string | null = (asgn as any).end_date ?? null

      for (const [monthKey, dueDateStr] of Object.entries(dates)) {
        if (!dueDateStr) continue

        // Skip dates before the client's configured start date
        if (dueDateStr < startDateStr) continue

        // Skip dates after the client's configured end date
        if (endDateStr && dueDateStr > endDateStr) continue

        // Compute trigger date (timezone-safe: no UTC round-trip)
        const triggerStr = shiftDays(dueDateStr, -daysBeforeDue)

        // Only spawn when trigger date has arrived
        if (triggerStr > today) continue

        // Never spawn tasks whose due date has already passed in the daily cron
        // (past tasks are handled by the manual Spawn Tasks trigger).
        if (dueDateStr < today) continue

        // Skip if already spawned for this assignment + due_date
        if (existingKeys.has(`${asgn.id}__${dueDateStr}`)) {
          alreadyExisted++
          continue
        }

        // Over the cap: leave it for tomorrow's run rather than risking the
        // whole run. Counted so the shortfall is visible instead of invisible.
        if (jobs.length >= MAX_SPAWNS_PER_RUN) { deferred++; continue }

        jobs.push({
          assignmentId: asgn.id,
          orgId:        asgn.org_id,
          clientId:     asgn.client_id,
          assigneeId:   asgn.assignee_id ?? null,
          approverId:   asgn.approver_id ?? null,
          title:        master.name,
          priority:     master.priority ?? 'medium',
          dueDate:      dueDateStr,
          monthKey,
        })
      }
    }

    // ── 4. Execute in batches, counting via step RETURN values ──────────────
    // A count carried in a closure is lost on replay; a returned one is not.
    let spawned = 0
    const batches = chunk(jobs, SPAWNS_PER_STEP)
    for (let i = 0; i < batches.length; i++) {
      spawned += await step.run(`spawn-batch-${i}`, async () => {
        let created = 0
        for (const job of batches[i]) {
          const { data: newTask, error: taskErr } = await admin
            .from('tasks')
            .insert({
              org_id:            job.orgId,
              title:             job.title,
              status:            'todo',
              priority:          job.priority,
              assignee_id:       job.assigneeId,
              approver_id:       job.approverId,
              approval_required: !!job.approverId,
              client_id:         job.clientId,
              due_date:          job.dueDate,
              is_recurring:      false,
              created_by:        null,
              custom_fields:     { _ca_compliance: true, _triggered: true, _assignment_id: job.assignmentId },
            })
            .select('id')
            .maybeSingle()

          if (taskErr || !newTask?.id) {
            console.error(`[caComplianceSpawn] task insert failed (${job.assignmentId}/${job.monthKey}):`, taskErr?.message)
            continue
          }

          // Record the instance — prevents re-creation on subsequent cron runs
          const { error: instErr } = await admin.from('ca_task_instances').insert({
            org_id:        job.orgId,
            assignment_id: job.assignmentId,
            task_id:       newTask.id,
            due_date:      job.dueDate,
            month_key:     job.monthKey,
            status:        'created',
          })
          if (instErr) {
            // Roll back the task so the next cron run can retry cleanly (avoids phantom tasks
            // that exist in `tasks` but have no instance record — the root cause of duplication).
            console.error(`[caComplianceSpawn] instance insert failed (${job.assignmentId}/${job.monthKey}):`, instErr.message)
            await admin.from('tasks').delete().eq('id', newTask.id)
            continue
          }

          created++
        }
        return created
      })
    }

    if (deferred > 0) {
      console.warn(`[caComplianceSpawn] Spawn cap (${MAX_SPAWNS_PER_RUN}) reached — ${deferred} deferred to the next cron run`)
    }
    return {
      date_checked:        today,
      assignments_checked: assignments.length,
      tasks_spawned:       spawned,
      already_existed:     alreadyExisted,
      cap_hit:             deferred > 0,
      deferred,
    }
  }
)
