import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { shiftDays }         from '@/lib/utils/recurringSchedule'
import { SPAWN_GRACE_DAYS, decideSpawn } from '@/lib/ca/spawnDecision'
import { todayInCountry, DEFAULT_COUNTRY } from '@/lib/locale/countries'
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
  // Fires daily at 7:20 AM IST AND can be triggered manually from /api/ca/trigger.
  //
  // Staggered, not simultaneous. This and two other heavy jobs all ran at 7:00,
  // so three full-table walks hit one shared-CPU database at the same instant
  // every morning. Still well before the 8:00 reminder pass, which needs the
  // tasks this spawns to already exist.
  [{ cron: '50 1 * * *' }, { event: 'ca/compliance-spawn-manual' }],

  async ({ step }) => {
    const admin = createAdminClient()

    // "Today" per ORG, not one hardcoded IST date for the whole platform.
    //
    // This was `Date.now() + 5h30m` for everyone. The product now ships
    // compliance catalogues for the US, UK, Canada and Australia, so a firm
    // outside India was being measured against a clock up to 12.5 hours away
    // from its own: a task could appear a day early, or a deadline read as
    // passed while the working day was still running.
    //
    // Resolved inside a step so it is memoised — the spawn batches below are
    // addressed by position, so a replay that crossed midnight would
    // otherwise plan different work than the batch ids already stand for.
    const todayByOrgArr: [string, string][] = await step.run('resolve-today-per-org', async () => {
      const { data } = await admin.from('org_settings').select('org_id, locale')
      return (data ?? []).map((r: any) => [
        r.org_id as string,
        todayInCountry((r.locale as { country?: string } | null)?.country),
      ] as [string, string])
    })
    const todayByOrg = new Map<string, string>(todayByOrgArr)

    // Fallback for an org with no settings row yet. India is the launch
    // market and the only one with a statutory catalogue shipped by default,
    // so it remains the right default — it is just no longer imposed on
    // everyone.
    const defaultToday: string = await step.run('resolve-default-today', async () =>
      todayInCountry(DEFAULT_COUNTRY))

    const todayFor = (orgId: string) => todayByOrg.get(orgId) ?? defaultToday

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
            )
          `)
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(from, to),
        // Belongs HERE, as fetchAllRows' second argument. It was once pasted
        // inside the select string above, which made the query unparseable:
        // PostgREST rejected every page, fetchAllRows returned an empty list
        // with an error, and the code below happily "checked 0 assignments".
        // Result: not one compliance task was created, for anyone, for as long
        // as it went unnoticed.
        { maxRows: 20_000 },
      )
      // Throw, never continue. An empty list here is indistinguishable from
      // "no firm has any assignments", so carrying on spawns nothing and
      // reports success. Throwing fails the Inngest run, which is what the
      // job-failure alert watches — the difference between finding this in
      // minutes and finding it when a client asks where their filings went.
      if (error) {
        const msg = (error as any)?.message ?? String(error)
        console.error('[caComplianceSpawn] fetch assignments:', msg)
        throw new Error(`Could not read CA client assignments: ${msg}`)
      }
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

    // ── 2b. Tasks that already exist, as a second dedup signal ──────────────
    // The cron used to look ONLY at ca_task_instances. A task whose spawn
    // record was missing was therefore invisible to it, so it re-attempted
    // that task every night: the unique index rejected the insert, no record
    // was ever written, and it retried forever. The manual route has always
    // checked both; this is the same check.
    //
    // Bounded by date, which is what makes it affordable platform-wide. The
    // loop below only considers due dates from (today - grace) onwards, so a
    // task outside that window cannot change any decision. Without the bound
    // this would scan every compliance task ever created, for every firm,
    // every night.
    // The earliest "today" across all orgs. Using any later date would make
    // the window too narrow for the orgs behind it, and a missing task from
    // this set reads as "not created" — the exact duplicate attempt this
    // fetch exists to prevent.
    const earliestToday = [defaultToday, ...todayByOrg.values()].sort()[0]
    const taskWindowStart = shiftDays(earliestToday, -SPAWN_GRACE_DAYS)
    const existingTaskKeysArr: string[] = await step.run('fetch-existing-tasks', async () => {
      const { data, error } = await fetchAllRows<any>(
        (from, to) => admin
          .from('tasks')
          .select('title, client_id, due_date')
          .is('parent_task_id', null)
          .contains('custom_fields', { _ca_compliance: true })
          .gte('due_date', taskWindowStart)
          .order('id', { ascending: true })
          .range(from, to),
        { maxRows: 50_000 },
      )
      if (error) {
        // A partial set would reintroduce exactly the duplicate attempts this
        // check exists to prevent, so stop rather than guess.
        console.error('[caComplianceSpawn] fetch existing tasks:', (error as any)?.message)
        throw new Error('Could not read existing CA compliance tasks')
      }
      // Archived and completed rows are deliberately included: the question is
      // "was this obligation ever created?", not "is it on the board now".
      return data.map((t: any) => `${t.title}__${t.client_id ?? ''}__${t.due_date ?? ''}`)
    })
    const existingTaskKeys = new Set<string>(existingTaskKeysArr)

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

        // Every rule lives in decideSpawn, which "Spawn tasks now" and the
        // Missed Tasks report also call. Restating them here is how the two
        // paths drifted apart in the first place.
        //
        // graceDays: the nightly run back-fills a bounded window. It used to
        // skip ANY past date, so a single failed or capped run lost that
        // occurrence forever — a firm found 33 such tasks spread over six
        // months, and only by building a spreadsheet by hand. Unbounded
        // back-fill is the opposite mistake: a calendar edit would bury a
        // team under months of history in one night.
        const decision = decideSpawn({
          dueDate:       dueDateStr,
          startDate:     startDateStr,
          endDate:       endDateStr,
          daysBeforeDue,
          today:         todayFor(asgn.org_id),
          graceDays:     SPAWN_GRACE_DAYS,
          hasInstance:   existingKeys.has(`${asgn.id}__${dueDateStr}`),
          hasTask:       existingTaskKeys.has(`${master.name}__${asgn.client_id ?? ''}__${dueDateStr}`),
        })

        if (!decision.spawn) {
          if (decision.reason === 'already_exists') alreadyExisted++
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
      // One date can no longer describe a platform-wide run; report the
      // default and how many distinct business days were in play.
      date_checked:        defaultToday,
      distinct_org_dates:  new Set([defaultToday, ...todayByOrg.values()]).size,
      assignments_checked: assignments.length,
      tasks_spawned:       spawned,
      already_existed:     alreadyExisted,
      cap_hit:             deferred > 0,
      deferred,
    }
  }
)
