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
 * WHY THE MARKER LIVES ON THE TASK
 * --------------------------------
 * Reactivating must restore what THIS action archived and nothing else — a
 * task the firm deleted by hand last month is not part of the engagement
 * coming back. The first version recorded the ids on clients.custom_fields.
 * That column DOES NOT EXIST, and reading it broke every client save with
 * "Client not found". The flag now lives on tasks.custom_fields, which does
 * exist and is already used this way for _ca_compliance.
 */
// Relative, not the '@/' alias: the node test runner cannot resolve the alias,
// and a lib with no tests is how this file's class of bug got in.
import { chunk } from '../supabase/fetchAll.ts'

/** Set on tasks.custom_fields for rows archived by a client deactivation. */
export const ARCHIVED_WITH_CLIENT = '_archived_with_client'

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
  tasksArchived:          number
  assignmentsDeactivated: number
}

/** Tasks that count as "open work" and so get archived. History is left alone. */
const OPEN_EXCLUDED = '(completed,cancelled)'

/** Merge one key into a task's custom_fields without disturbing the rest. */
function withFlag(existing: unknown, value: boolean | undefined): Record<string, unknown> {
  const base = (existing && typeof existing === 'object' && !Array.isArray(existing))
    ? { ...(existing as Record<string, unknown>) }
    : {}
  if (value === undefined) delete base[ARCHIVED_WITH_CLIENT]
  else base[ARCHIVED_WITH_CLIENT] = value
  return base
}

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
      .not('status', 'in', OPEN_EXCLUDED)
      .or('is_archived.is.null,is_archived.eq.false'),
    admin.from('ca_client_assignments').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('client_id', clientId).eq('is_active', true),
  ])
  return { tasksArchived: tasks ?? 0, assignmentsDeactivated: assignments ?? 0 }
}

/** Archive the client's open tasks and stop their compliance spawning. */
export async function deactivateClient(
  admin: any, orgId: string, clientId: string,
): Promise<DeactivationResult> {
  // `or('is_archived.is.null,...')` rather than `neq('is_archived', true)`:
  // NULL <> true is NULL, not true, so the simpler form silently skips every
  // row where the column was never set.
  const { data: open } = await admin.from('tasks')
    .select('id, custom_fields')
    .eq('org_id', orgId).eq('client_id', clientId)
    .not('status', 'in', OPEN_EXCLUDED)
    .or('is_archived.is.null,is_archived.eq.false')

  const tasks = open ?? []
  const now = new Date().toISOString()
  // One update per task, because the flag has to be merged into that task's
  // own custom_fields — a bulk update would overwrite _ca_compliance and the
  // rest. Chunked so a client with many tasks does not open hundreds of
  // connections at once.
  for (const batch of chunk(tasks, 25)) {
    await Promise.all(batch.map((t: any) => admin.from('tasks')
      .update({
        is_archived: true,
        deleted_at: now,
        custom_fields: withFlag(t.custom_fields, true),
      })
      .eq('id', t.id).eq('org_id', orgId)))
  }

  const { data: assignments } = await admin.from('ca_client_assignments')
    .select('id').eq('org_id', orgId).eq('client_id', clientId).eq('is_active', true)
  const ids = (assignments ?? []).map((a: any) => a.id as string)
  for (const batch of chunk(ids)) {
    await admin.from('ca_client_assignments').update({ is_active: false }).in('id', batch)
  }

  return { tasksArchived: tasks.length, assignmentsDeactivated: ids.length }
}

/**
 * Put back exactly what deactivation took away.
 *
 * Tasks: only those carrying the flag. A task archived for any other reason,
 * before or since, stays archived — reactivating a client is not an undelete.
 *
 * Assignments: every inactive one for this client. There is no per-row marker
 * to be had, and it is safe: an assignment the firm wound down deliberately
 * carries an end_date, and the spawner skips a date past it as 'after_end', so
 * switching it back on creates nothing.
 */
export async function reactivateClient(
  admin: any, orgId: string, clientId: string,
): Promise<{ tasksRestored: number; assignmentsReactivated: number }> {
  const { data: flagged } = await admin.from('tasks')
    .select('id, custom_fields')
    .eq('org_id', orgId).eq('client_id', clientId)
    .contains('custom_fields', { [ARCHIVED_WITH_CLIENT]: true })

  const tasks = flagged ?? []
  for (const batch of chunk(tasks, 25)) {
    await Promise.all(batch.map((t: any) => admin.from('tasks')
      .update({
        is_archived: false,
        deleted_at: null,
        // Flag cleared, so a second deactivation starts from a clean slate.
        custom_fields: withFlag(t.custom_fields, undefined),
      })
      .eq('id', t.id).eq('org_id', orgId)))
  }

  const { data: assignments } = await admin.from('ca_client_assignments')
    .select('id').eq('org_id', orgId).eq('client_id', clientId).eq('is_active', false)
  const ids = (assignments ?? []).map((a: any) => a.id as string)
  for (const batch of chunk(ids)) {
    await admin.from('ca_client_assignments').update({ is_active: true }).in('id', batch)
  }

  return { tasksRestored: tasks.length, assignmentsReactivated: ids.length }
}
