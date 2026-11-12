/**
 * Marking a client inactive, and putting it back.
 *
 * WHAT A FIRM MEANS BY "INACTIVE"
 * -------------------------------
 * The engagement has ended but the record must stay — for history, billing and
 * audit. What should stop is the WORK: no open tasks cluttering the board, and
 * no new compliance tasks spawning every month for a client nobody is serving.
 *
 * WHY THIS ARCHIVES RATHER THAN HIDES
 * -----------------------------------
 * The obvious implementation is to filter tasks of inactive clients out of
 * every view. That was rejected deliberately. It leaves rows that exist, still
 * count in places, and appear nowhere — and invisible work is precisely the
 * failure this codebase has been bitten by repeatedly: compliance obligations
 * skipped in silence, spawn records pointing at deleted tasks, 44 undated
 * tasks nobody could find. Archiving is visible in Trash, reversible, and
 * leaves no row in a state the UI cannot explain.
 *
 * WHY THE IDS ARE RECORDED
 * ------------------------
 * Reactivating must restore what THIS action archived, and nothing else. A
 * task the firm deleted by hand last month is not part of the engagement
 * coming back. So the ids are written on the client and read back on restore,
 * rather than inferring from timestamps, which would sweep up unrelated
 * deletions.
 */
// Relative, not the '@/' alias: the node test runner cannot resolve the alias,
// and a lib with no tests is how the rest of this file's class of bug got in.
import { chunk } from '../supabase/fetchAll.ts'

/** Where the archived ids live on clients.custom_fields. */
export const ARCHIVED_TASKS_KEY       = '_deactivation_archived_task_ids'
export const DEACTIVATED_ASSIGN_KEY   = '_deactivation_assignment_ids'

export type StatusChange = 'deactivate' | 'reactivate' | null

/**
 * Which transition a status edit represents.
 *
 * 'prospect' is NOT inactive: it is a client the firm is chasing, and their
 * tasks are real work. Only 'inactive' stops anything.
 */
export function statusChange(prev: string | null | undefined, next: string | null | undefined): StatusChange {
  const before = (prev ?? '').trim().toLowerCase()
  const after  = (next ?? '').trim().toLowerCase()
  if (before === after) return null
  if (after === 'inactive') return 'deactivate'
  if (before === 'inactive') return 'reactivate'
  return null
}

export interface DeactivationResult {
  tasksArchived:           number
  assignmentsDeactivated:  number
}

/** Tasks that count as "open work" and so get archived. History is left alone. */
const OPEN_STATUSES_EXCLUDED = ['completed', 'cancelled']

/**
 * Count what deactivating would archive, without changing anything.
 * The UI shows this in the confirmation so nobody is surprised by the result.
 */
export async function previewDeactivation(
  admin: any, orgId: string, clientId: string,
): Promise<DeactivationResult> {
  const [{ count: tasks }, { count: assignments }] = await Promise.all([
    admin.from('tasks').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('client_id', clientId)
      .not('status', 'in', `(${OPEN_STATUSES_EXCLUDED.join(',')})`)
      .or('is_archived.is.null,is_archived.eq.false'),
    admin.from('ca_client_assignments').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('client_id', clientId).eq('is_active', true),
  ])
  return { tasksArchived: tasks ?? 0, assignmentsDeactivated: assignments ?? 0 }
}

/**
 * Archive the client's open tasks and stop their compliance spawning.
 *
 * Returns the ids to record on the client so reactivation can undo exactly
 * this and nothing more.
 */
export async function deactivateClient(
  admin: any, orgId: string, clientId: string,
): Promise<DeactivationResult & { taskIds: string[]; assignmentIds: string[] }> {
  // `or('is_archived.is.null,...')` rather than `neq('is_archived', true)`:
  // NULL <> true is NULL, not true, so the simpler form silently skips every
  // row where the column was never set.
  const { data: openTasks } = await admin.from('tasks')
    .select('id')
    .eq('org_id', orgId).eq('client_id', clientId)
    .not('status', 'in', `(${OPEN_STATUSES_EXCLUDED.join(',')})`)
    .or('is_archived.is.null,is_archived.eq.false')

  const taskIds = (openTasks ?? []).map((t: any) => t.id as string)
  const now = new Date().toISOString()
  for (const ids of chunk(taskIds)) {
    await admin.from('tasks').update({ is_archived: true, deleted_at: now }).in('id', ids)
  }

  const { data: assignments } = await admin.from('ca_client_assignments')
    .select('id').eq('org_id', orgId).eq('client_id', clientId).eq('is_active', true)
  const assignmentIds = (assignments ?? []).map((a: any) => a.id as string)
  for (const ids of chunk(assignmentIds)) {
    await admin.from('ca_client_assignments').update({ is_active: false }).in('id', ids)
  }

  return {
    tasksArchived: taskIds.length,
    assignmentsDeactivated: assignmentIds.length,
    taskIds, assignmentIds,
  }
}

/**
 * Put back exactly what deactivation took away.
 *
 * Restores only the recorded ids. A task archived for any other reason, before
 * or since, stays archived — reactivating a client is not an undelete.
 */
export async function reactivateClient(
  admin: any, orgId: string, clientId: string, stored: Record<string, unknown> | null,
): Promise<{ tasksRestored: number; assignmentsReactivated: number }> {
  const taskIds       = asIdList(stored?.[ARCHIVED_TASKS_KEY])
  const assignmentIds = asIdList(stored?.[DEACTIVATED_ASSIGN_KEY])

  for (const ids of chunk(taskIds)) {
    // Scoped by org and client as well as id: a recorded id must still belong
    // to this client to come back, in case the task was moved meanwhile.
    await admin.from('tasks')
      .update({ is_archived: false, deleted_at: null })
      .in('id', ids).eq('org_id', orgId).eq('client_id', clientId)
  }
  for (const ids of chunk(assignmentIds)) {
    await admin.from('ca_client_assignments')
      .update({ is_active: true })
      .in('id', ids).eq('org_id', orgId).eq('client_id', clientId)
  }
  return { tasksRestored: taskIds.length, assignmentsReactivated: assignmentIds.length }
}

/** Defensive: the stored value is whatever is in the database, not a promise. */
export function asIdList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
}
