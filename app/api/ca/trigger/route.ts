import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { dbError } from '@/lib/api-error'
import type { NextRequest }    from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { decideSpawn, skipReasonText } from '@/lib/ca/spawnDecision'
import { todayInCountry }      from '@/lib/locale/countries'
import { fetchAllRows, chunk } from '@/lib/supabase/fetchAll'

/**
 * This route had NO maxDuration while every neighbouring route set one
 * (assignments 30, propagate 30, import-csv 60). It inserts sequentially —
 * a task and then its spawn record, two round trips per occurrence — across
 * the whole org, so a first-time setup or a long backfill ran past the
 * platform default and died partway with no explanation.
 *
 * 60 matches import-csv, the heaviest route already proven on this plan.
 */
export const maxDuration = 60

/**
 * Hard ceiling on one invocation, so the work cannot outlive the budget
 * above. Two round trips per spawn at ~40ms each is roughly 24s for 300,
 * leaving headroom for the reads at the top.
 *
 * Reaching it is not an error: the route is idempotent, so the remainder is
 * picked up by pressing the button again. What matters is that the shortfall
 * is REPORTED rather than looking like a clean finish — a silent timeout is
 * how a firm concludes everything spawned when half of it did not.
 */
const MAX_SPAWNS_PER_CALL = 300

/**
 * POST /api/ca/trigger
 * Admin-only: runs the CA compliance spawn logic DIRECTLY (synchronous).
 * Bypasses Inngest so tasks are created immediately and errors surface to the UI.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()

  // "Today" in THIS org's timezone, not a hardcoded IST date.
  //
  // The product ships compliance catalogues for the US, UK, Canada and
  // Australia, so assuming +5:30 measured a non-Indian firm against a clock
  // up to 12.5 hours from its own — enough to create a task a day early or
  // treat a deadline as passed mid-working-day.
  const { data: orgSettings } = await admin.from('org_settings')
    .select('locale').eq('org_id', mb.org_id).maybeSingle()
  const today = todayInCountry((orgSettings?.locale as { country?: string } | null)?.country)

  // ── 0. Clean up any legacy compliance subtasks (attachment headers that were
  //       incorrectly created as subtask rows). Attachment headers are now shown
  //       only as a UI checklist — not as subtasks.
  const { data: legacyRows } = await fetchAllRows<{ id: string }>(
    (from, to) => admin
      .from('tasks')
      .select('id')
      .eq('org_id', mb.org_id)
      .not('parent_task_id', 'is', null)
      .contains('custom_fields', { _compliance_subtask: true })
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )

  if (legacyRows && legacyRows.length > 0) {
    const legacyIds = legacyRows.map(r => r.id)
    // Chunked: a few thousand ids in one `.in()` overruns the URL length limit
    // in front of Postgres and comes back 414, which reads as a plain failure.
    for (const ids of chunk(legacyIds)) {
      const { error: cleanErr } = await admin.from('tasks').delete().in('id', ids)
      if (cleanErr) console.error('[ca/trigger] legacy subtask cleanup failed:', cleanErr.message)
    }
    console.log(`[ca/trigger] cleaned up ${legacyIds.length} legacy compliance subtask(s)`)
  }

  // ── 1. Fetch all active assignments for this org ──────────────────
  // Paged: PostgREST caps a single response at max-rows and truncates in
  // silence, so a firm past the cap had assignments that this route never even
  // looked at — their clients' compliance tasks were never created.
  const { data: assignments, error: asgErr } = await fetchAllRows<any>(
    (from, to) => admin
      .from('ca_client_assignments')
      .select(`
        id, org_id, client_id, assignee_id, approver_id, created_at, start_date, end_date,
        master_task:ca_master_tasks(id, name, priority, dates, days_before_due, attachment_headers, attachment_count)
      `)
      .eq('org_id', mb.org_id)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )

  if (asgErr) {
    console.error('[ca/trigger] fetch assignments:', (asgErr as any)?.message)
    return NextResponse.json(dbError(asgErr, 'ca/trigger'), { status: 500 })
  }
  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ ok: true, spawned: 0, message: 'No active assignments found. Import clients in Step 2 first.' })
  }

  // ── 2. Fetch already-spawned instances for this org ───────────────
  // Paged for the same reason — a truncated dedup set makes this route re-attempt
  // work it already did, which the unique constraint then rejects.
  const { data: instances } = await fetchAllRows<any>(
    (from, to) => admin
      .from('ca_task_instances')
      .select('assignment_id, due_date, task_id')
      .eq('org_id', mb.org_id)
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )

  // ORPHANED RECORDS DO NOT COUNT AS "already spawned" HERE.
  //
  // ca_task_instances.task_id is `REFERENCES tasks(id) ON DELETE SET NULL`, so
  // deleting a compliance task leaves its spawn record behind with task_id
  // NULL -- and that record still holds UNIQUE (assignment_id, due_date).
  // Treating it as proof the task exists is what made a deleted obligation
  // unrecoverable: the task was gone, every later run skipped it as
  // 'already_exists', and this button could not bring it back either.
  //
  // The nightly cron deliberately still counts them, so nothing resurrects on
  // its own overnight. This route is a person explicitly asking to catch up,
  // which is exactly when recreating a deleted task is the intended outcome.
  const existingKeys = new Set(
    (instances ?? [])
      .filter((r: any) => r.task_id !== null)
      .map((r: any) => `${r.assignment_id}__${r.due_date}`)
  )

  // Also check actual tasks table — guards against ca_task_instances being out of sync
  // (e.g. if a previous spawn wrote the task but the instance insert failed).
  //
  // ARCHIVED ROWS COUNT HERE. This deliberately has no is_archived filter:
  // the question is "was this obligation ever created?", not "is it on the
  // board right now". With `.neq('is_archived', true)` a task that had been
  // completed and then archived was invisible to this check, so if its
  // ca_task_instances row was also missing it was created a SECOND time —
  // which is exactly what the backfill did to already-completed tasks.
  // (That filter also dropped rows where is_archived IS NULL, since
  // `is_archived <> true` is NULL for them, widening the same hole.)
  // Restoring a wrongly-archived task is the Trash's job, not the spawner's.
  const { data: existingCATasks } = await fetchAllRows<any>(
    (from, to) => admin
      .from('tasks')
      .select('id, title, client_id, due_date')
      .eq('org_id', mb.org_id)
      .contains('custom_fields', { _ca_compliance: true })
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )

  const existingTaskKeys = new Set(
    (existingCATasks ?? []).map((t: any) => `${t.title}__${t.client_id ?? ''}__${t.due_date ?? ''}`)
  )

  // ── 3. Walk each assignment × each due date ───────────────────────
  let spawned = 0
  let skipped = 0
  let deferred = 0
  const errors: string[] = []
  const detail: { client_id: string; task: string; month: string; due: string; action: string; reason?: string }[] = []

  for (const asgn of assignments) {
    const master = asgn.master_task as any
    if (!master) { skipped++; continue }

    const dates: Record<string, string> = master.dates ?? {}
    const daysBeforeDue: number = master.days_before_due ?? 7

    if (Object.keys(dates).length === 0) { skipped++; continue }

    // Lower bound for backfill: the assignment's start_date, else the date the
    // assignment was created.
    //
    // This used to fall back to TODAY, which quietly made the button useless
    // for the job it exists to do. start_date is nullable and was never
    // backfilled, so for most assignments the bound became "today" and every
    // obligation already due was skipped as "before start_date" — including
    // the ones a failed cron had missed, which is precisely when an admin
    // reaches for "Spawn tasks". The daily cron has always used created_at
    // here; the two paths simply disagreed.
    //
    // created_at keeps the protection that the `?? today` was reaching for: a
    // client onboarded today still cannot pull in a year of past filings,
    // because nothing predates their own assignment.
    const startDateStr: string = (asgn as any).start_date
      ?? ((asgn as any).created_at as string ?? '').split('T')[0]
      ?? today
    // Upper bound for a client being wound down. NULL = open-ended (every
    // assignment today), so this is inert until a date is actually set.
    // Applied here as well as in the daily cron, otherwise a manual "Spawn
    // tasks" would re-create exactly the work the end date exists to prevent.
    const endDateStr: string | null = (asgn as any).end_date ?? null

    for (const [monthKey, dueDateStr] of Object.entries(dates)) {
      if (!dueDateStr) continue

      const logBase = { client_id: asgn.client_id, task: master.name, month: monthKey, due: dueDateStr }

      const instanceKey = `${asgn.id}__${dueDateStr}`
      const taskKey     = `${master.name}__${asgn.client_id ?? ''}__${dueDateStr}`

      // Every rule lives in decideSpawn, shared with the nightly cron and the
      // Missed Tasks report, so the three cannot answer the same question
      // differently — which is precisely how they diverged before.
      //
      // graceDays: null — no back-fill limit. Catching up on what was missed
      // is the entire reason someone presses this button; a nightly run is
      // the one that has to stay bounded.
      const spawnInput = {
        dueDate:       dueDateStr,
        startDate:     startDateStr,
        endDate:       endDateStr,
        daysBeforeDue,
        today,
        graceDays:     null,
        hasInstance:   existingKeys.has(instanceKey),
        hasTask:       existingTaskKeys.has(taskKey),
      }
      const decision = decideSpawn(spawnInput)

      if (!decision.spawn) {
        skipped++
        detail.push({ ...logBase, action: 'skipped', reason: skipReasonText(decision.reason, spawnInput) })
        continue
      }

      // Budget reached: stop creating, but keep walking so `deferred` is a
      // true count of what is left rather than an unknown.
      if (spawned >= MAX_SPAWNS_PER_CALL) {
        deferred++
        detail.push({ ...logBase, action: 'deferred', reason: 'per-run limit reached' })
        continue
      }

      // ── Create the parent compliance task ──
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
          created_by:        user.id,           // use triggering admin's ID
          custom_fields:     { _ca_compliance: true, _triggered: true, _assignment_id: asgn.id },
        })
        .select('id')
        .maybeSingle()

      if (taskErr || !newTask?.id) {
        const msg = `${master.name} (${monthKey}): ${taskErr?.message ?? 'insert failed'}`
        errors.push(msg)
        console.error('[ca/trigger] task insert failed:', msg)
        continue
      }

      // ── Record instance to prevent re-spawn ──
      // The error was previously ignored here, while the cron rolls the task
      // back on the same failure. That asymmetry produced exactly the state
      // the cron's comment calls "the root cause of duplication": a task with
      // no spawn record. Nothing ever reconciled it, and every later run
      // re-attempted the same occurrence.
      // upsert, not insert: when this occurrence is being recreated after its
      // task was deleted, the orphaned spawn record is still there and still
      // holds UNIQUE (assignment_id, due_date). A plain insert would hit that
      // constraint, the task below would be rolled back, and the occurrence
      // would stay unrecoverable -- the exact state this change exists to end.
      // Re-pointing the existing record keeps one row per occurrence and
      // preserves its original created_at as the audit trail.
      const { error: instErr } = await admin.from('ca_task_instances').upsert({
        org_id:        asgn.org_id,
        assignment_id: asgn.id,
        task_id:       newTask.id,
        due_date:      dueDateStr,
        month_key:     monthKey,
        status:        'created',
      }, { onConflict: 'assignment_id,due_date' })

      if (instErr) {
        // Undo the task so the next run can retry cleanly, rather than
        // leaving a row that nothing can account for.
        await admin.from('tasks').delete().eq('id', newTask.id)
        const msg = `${master.name} (${monthKey}): spawn record failed — ${instErr.message}`
        errors.push(msg)
        console.error('[ca/trigger] instance insert failed:', msg)
        continue
      }

      existingKeys.add(instanceKey)   // prevent duplicate within same request
      existingTaskKeys.add(taskKey)   // same
      detail.push({ client_id: asgn.client_id, task: master.name, month: monthKey, due: dueDateStr, action: 'spawned' })
      spawned++
    }
  }

  // A run that stopped at the cap must not read as a clean finish — that is
  // exactly how half a backfill gets mistaken for all of it.
  const message = deferred > 0
    ? `Created ${spawned} task(s). ${deferred} still to go — press the button again to continue.`
    : spawned > 0
      ? `Successfully spawned ${spawned} compliance task(s).`
      : `No tasks to spawn yet. Tasks appear N days before their due date (trigger windows haven't been reached for any assignment).`

  return NextResponse.json({
    ok: true,
    spawned,
    skipped,
    deferred,
    today,
    assignments_checked: assignments.length,
    legacy_subtasks_removed: legacyRows?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
    detail,
    message,
  })
}
