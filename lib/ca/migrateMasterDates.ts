import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Move already-spawned CA compliance tasks when a master task's due dates change.
 *
 * WHY THIS EXISTS
 * ---------------
 * A master task's `dates` map is the DEFINITION of an obligation, not a new
 * obligation. Before this helper, moving a date only updated the master row;
 * the spawned client tasks were moved by a confirmation modal in the UI, and
 * only if the user confirmed it.
 *
 * That gap caused a live incident. On 29 Sep 2026 the "ITR (with Audit)"
 * master moved from 2026-10-31 to 2026-11-21. The modal was not confirmed, so
 * 44 spawned tasks stayed on 31 Oct. The nightly spawner dedupes on
 * (assignment_id, due_date), so 21 Nov looked like a date it had never
 * spawned for, and on 30 Sep it created a SECOND task for 40 clients.
 *
 * Note that deduping on month_key instead would not have helped: the key
 * itself changed, 'oct' -> 'nov'. The only correct place to fix this is here,
 * at the moment the definition changes, server-side, where it cannot be
 * skipped by closing a dialog.
 *
 * WHAT IT DOES, per changed month:
 *   1. moves incomplete spawned tasks from the old date to the new one
 *   2. moves their incomplete subtasks that shared the old date
 *   3. re-points the ca_task_instances dedup row at the new date and month
 *
 * It deliberately does NOT touch completed or archived tasks: those record
 * what was actually done against the deadline that applied at the time.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface DateChange { monthKey: string; old: string; new: string }

export interface MigrateResult {
  tasksMoved:     number
  instancesMoved: number
  /**
   * Dedup rows deliberately LEFT on the old date, because the task they point
   * at did not move -- it was completed, archived or deleted. Advancing those
   * would make the new occurrence unspawnable, so they stay put and the new
   * date is free for the spawner to fill.
   */
  instancesLeft:  number
  /** Non-fatal problems. The caller surfaces these; they are never swallowed. */
  warnings:       string[]
}

/**
 * Work out which months actually changed.
 * A month present in `next` but absent from `prev` is a NEW obligation, not a
 * move — there is nothing spawned to migrate, so it is skipped.
 */
export function diffDates(
  prev: Record<string, string> | null | undefined,
  next: Record<string, string> | null | undefined,
): DateChange[] {
  const before = prev ?? {}
  const after  = next ?? {}
  const out: DateChange[] = []

  for (const [monthKey, newDate] of Object.entries(after)) {
    const oldDate = before[monthKey]
    if (!newDate || !oldDate) continue
    if (oldDate === newDate) continue
    if (!DATE_RE.test(oldDate) || !DATE_RE.test(newDate)) continue
    out.push({ monthKey, old: oldDate, new: newDate })
  }

  // A month can also be RENAMED when a date moves across a month boundary —
  // 'oct': '2026-10-31' becoming 'nov': '2026-11-21' is one obligation moving,
  // but it reads as one key disappearing and another appearing.
  //
  // Pair a disappeared key with an appeared key when exactly one of each is
  // unaccounted for. More than one of either is ambiguous, and guessing which
  // pairs with which would move real deadlines to the wrong day, so those are
  // left alone and reported.
  const removed = Object.keys(before).filter(k => !(k in after) && DATE_RE.test(before[k] ?? ''))
  const added   = Object.keys(after).filter(k => !(k in before) && DATE_RE.test(after[k] ?? ''))
  if (removed.length === 1 && added.length === 1) {
    out.push({ monthKey: added[0], old: before[removed[0]], new: after[added[0]] })
  }

  return out
}

export async function migrateMasterDates(
  admin:        SupabaseClient,
  orgId:        string,
  masterTaskId: string,
  changes:      DateChange[],
): Promise<MigrateResult> {
  const result: MigrateResult = { tasksMoved: 0, instancesMoved: 0, instancesLeft: 0, warnings: [] }
  if (changes.length === 0) return result

  // Every assignment of this master task. Scoping by assignment rather than by
  // task title is what keeps this correct after a rename, and stops it from
  // touching a different master task that happens to share a name.
  const { data: assignments, error: asgErr } = await admin
    .from('ca_client_assignments')
    .select('id')
    .eq('org_id', orgId)
    .eq('master_task_id', masterTaskId)

  if (asgErr) {
    result.warnings.push(`Could not load assignments: ${asgErr.message}`)
    return result
  }

  const assignmentIds = (assignments ?? []).map(a => a.id as string)
  if (assignmentIds.length === 0) return result

  for (const change of changes) {
    // The dedup rows for this month, which also tell us exactly which tasks
    // belong to this obligation.
    const { data: instances, error: instErr } = await admin
      .from('ca_task_instances')
      .select('id, task_id, assignment_id')
      .eq('org_id', orgId)
      .in('assignment_id', assignmentIds)
      .eq('due_date', change.old)

    if (instErr) {
      result.warnings.push(`Could not load instances for ${change.old}: ${instErr.message}`)
      continue
    }

    const rows    = instances ?? []
    const taskIds = rows.map(r => r.task_id as string).filter(Boolean)

    // Which tasks actually moved. Declared out here because step 3 must not
    // re-point a dedup row whose task stayed behind -- see the note there.
    const movedIdSet = new Set<string>()

    // ── 1. Move the spawned tasks ──────────────────────────────────────────
    if (taskIds.length > 0) {
      const { data: moved, error: taskErr } = await admin
        .from('tasks')
        .update({ due_date: change.new, updated_at: new Date().toISOString() })
        .in('id', taskIds)
        .eq('org_id', orgId)
        .eq('due_date', change.old)
        // Completed work records the deadline that applied when it was done.
        .not('status', 'eq', 'completed')
        // is_archived is null on older rows, and `<> true` would drop those
        // because NULL <> true is NULL, not true.
        .or('is_archived.is.null,is_archived.eq.false')
        .select('id')

      if (taskErr) {
        result.warnings.push(`Could not move tasks for ${change.old}: ${taskErr.message}`)
        continue
      }

      const movedIds = (moved ?? []).map(t => t.id as string)
      for (const id of movedIds) movedIdSet.add(id)
      result.tasksMoved += movedIds.length

      // ── 2. Their open subtasks that shared the parent's date ─────────────
      if (movedIds.length > 0) {
        const { error: subErr } = await admin
          .from('tasks')
          .update({ due_date: change.new, updated_at: new Date().toISOString() })
          .in('parent_task_id', movedIds)
          .eq('due_date', change.old)
          .not('status', 'eq', 'completed')
        if (subErr) result.warnings.push(`Could not move subtasks for ${change.old}: ${subErr.message}`)
      }
    }

    // ── 3. Re-point the dedup rows ─────────────────────────────────────────
    // Without this the next cron run sees an unknown due date and spawns a
    // duplicate — which is the exact failure this helper exists to prevent.
    //
    // ca_task_instances carries UNIQUE (assignment_id, due_date). If a row
    // already sits on the new date for the same assignment, this update would
    // abort the whole statement, so those are moved one at a time and a
    // collision is reported rather than silently losing the rest.
    //
    // ONLY rows whose task actually moved. Step 1 deliberately leaves two
    // kinds of task behind -- completed ones (they record the deadline that
    // applied when the work was done) and archived/deleted ones -- and this
    // loop used to advance their dedup rows anyway.
    //
    // The result was an obligation that could never be created. The record
    // claimed the new date was already spawned while the task it pointed at
    // still sat on the old one, so the spawner skipped the new date for ever,
    // silently. A firm hit exactly this: HVAT (Return) tasks deleted in April
    // kept due_date 2025-10-31 while their records were advanced to
    // 2026-10-31, and the 2026 task was never created for any client.
    //
    // Leaving the row on the old date is correct and carries no duplicate
    // risk: the task is still there on the old date, and the new date is a
    // genuinely different occurrence that SHOULD be spawned.
    for (const row of rows) {
      if (!row.task_id || !movedIdSet.has(row.task_id as string)) {
        result.instancesLeft++
        continue
      }
      const { error: upErr } = await admin
        .from('ca_task_instances')
        .update({ due_date: change.new, month_key: change.monthKey })
        .eq('id', row.id)

      if (upErr) {
        result.warnings.push(
          `A spawn record for ${change.new} already exists on one assignment; ` +
          `its task may be duplicated. (${upErr.message})`,
        )
        continue
      }
      result.instancesMoved++
    }
  }

  return result
}
