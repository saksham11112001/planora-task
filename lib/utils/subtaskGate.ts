/**
 * The "complete all subtasks first" gate, in one place.
 *
 * WHY THIS IS SHARED
 *   Two routes enforce it — PATCH /api/tasks/[id] when a parent is set to
 *   completed, and POST /api/tasks/[id]/approve when it is submitted — and they
 *   had drifted. The approve route excluded compliance placeholders; the PATCH
 *   route did not. Neither excluded deleted subtasks.
 *
 * WHAT WENT WRONG
 *   A parent showed "4/4 subtasks" in the panel and still refused to complete,
 *   reporting "1 remaining". The panel and the gate were counting different
 *   sets:
 *
 *     - Deletion is soft (is_archived = true). The list endpoint filters those
 *       out; the gate did not. So deleting an unfinished subtask blocked its
 *       parent permanently, with nothing on screen to explain it.
 *
 *     - The list endpoint also narrows subtasks for non-managers to ones they
 *       are assignee, approver or creator of. A subtask belonging to a
 *       colleague is therefore invisible to them while still counting here.
 *
 *   The first is a bug and is fixed. The second is deliberate visibility, so
 *   the fix is to NAME the blocker in the message: being told "1 remaining"
 *   while looking at four completed subtasks is unactionable, and the person
 *   cannot even tell who to ask.
 */

export interface SubtaskRow {
  id:             string
  title?:         string | null
  status?:        string | null
  is_archived?:   boolean | null
  custom_fields?: Record<string, unknown> | null
}

/** Columns the gate needs. Use this in the select so callers cannot under-fetch. */
export const SUBTASK_GATE_COLS = 'id, title, status, is_archived, custom_fields'

/**
 * Subtasks that genuinely have to be finished before the parent can be.
 *
 * Excluded:
 *   - archived rows — a deleted subtask is not outstanding work. Written as an
 *     explicit truthiness test rather than a `.neq('is_archived', true)` on the
 *     query, because in SQL `NULL <> true` is NULL, so that form silently drops
 *     rows where the column was never set.
 *   - _compliance_subtask rows — attachment-header placeholders, not work.
 */
export function blockingSubtasks(rows: SubtaskRow[] | null | undefined): SubtaskRow[] {
  return (rows ?? []).filter(s =>
    !s.is_archived &&
    s.custom_fields?._compliance_subtask !== true &&
    s.status !== 'completed',
  )
}

/**
 * The message shown when the gate blocks. Names what is outstanding, up to
 * three, so the person can act on it — including when the subtask is one their
 * role does not let them see in the list.
 */
export function subtaskGateMessage(incomplete: SubtaskRow[]): string {
  const named = incomplete.map(s => s.title?.trim()).filter(Boolean) as string[]
  if (named.length === 0) {
    return `Complete all subtasks first — ${incomplete.length} remaining`
  }
  const shown = named.slice(0, 3).join(', ')
  const more  = named.length > 3 ? ` and ${named.length - 3} more` : ''
  const tail  = incomplete.length > 0
    ? '. If you cannot see it in the list, it belongs to a colleague — ask them to finish it, or ask an admin to complete this task.'
    : ''
  return `Complete all subtasks first — still open: ${shown}${more}${tail}`
}
