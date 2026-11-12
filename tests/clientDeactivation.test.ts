/**
 * Marking a client inactive archives its open work and stops its compliance
 * spawning; reactivating puts back exactly that and nothing else.
 *
 * The "nothing else" half is the one worth testing. A reactivation that also
 * un-deletes tasks the firm removed on purpose would be worse than one that
 * restored nothing.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  statusChange, asIdList, deactivateClient, reactivateClient, previewDeactivation,
  ARCHIVED_TASKS_KEY, DEACTIVATED_ASSIGN_KEY,
} from '../lib/clients/deactivation.ts'

/* ── which edits mean what ───────────────────────────────────────────────── */

describe('statusChange', () => {
  test('going inactive deactivates', () => {
    assert.equal(statusChange('active', 'inactive'), 'deactivate')
    assert.equal(statusChange('prospect', 'inactive'), 'deactivate')
  })

  test('leaving inactive reactivates, whichever status it goes to', () => {
    assert.equal(statusChange('inactive', 'active'), 'reactivate')
    assert.equal(statusChange('inactive', 'prospect'), 'reactivate')
  })

  test('prospect is NOT inactive — their work is real and stays', () => {
    assert.equal(statusChange('active', 'prospect'), null)
    assert.equal(statusChange('prospect', 'active'), null)
  })

  test('no change means no side effects, including re-saving the same status', () => {
    assert.equal(statusChange('inactive', 'inactive'), null)
    assert.equal(statusChange('active', 'active'), null)
  })

  test('casing, padding and missing values do not trigger anything unexpected', () => {
    assert.equal(statusChange('Active', 'INACTIVE'), 'deactivate')
    assert.equal(statusChange(' inactive ', 'active'), 'reactivate')
    assert.equal(statusChange(null, null), null)
    assert.equal(statusChange(undefined, 'active'), null)
  })
})

describe('asIdList', () => {
  test('anything that is not a list of non-empty strings is ignored', () => {
    assert.deepEqual(asIdList(['a', 'b']), ['a', 'b'])
    assert.deepEqual(asIdList(['a', '', null, 7, 'b']), ['a', 'b'])
    assert.deepEqual(asIdList(null), [])
    assert.deepEqual(asIdList('a,b'), [])
    assert.deepEqual(asIdList({ 0: 'a' }), [])
  })
})

/* ── the database work ───────────────────────────────────────────────────── */

/** Chainable stub that records every update it is asked to perform. */
function makeAdmin(rows: { tasks?: { id: string }[]; assignments?: { id: string }[] }) {
  const updates: { table: string; patch: Record<string, unknown>; ids: string[]; filters: Record<string, unknown> }[] = []
  const counts: Record<string, number> = {}
  const admin: any = {
    updates, counts,
    from(table: string) {
      let op: 'select' | 'update' = 'select'
      let patch: Record<string, unknown> = {}
      let ids: string[] = []
      const filters: Record<string, unknown> = {}
      let head = false
      const b: any = {
        select: (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return b },
        update: (p: Record<string, unknown>) => { op = 'update'; patch = p; return b },
        in:  (_c: string, v: string[]) => { ids = v; return b },
        eq:  (c: string, v: unknown) => { filters[c] = v; return b },
        not: () => b,
        or:  () => b,
        then: (resolve: (v: unknown) => void) => {
          if (op === 'update') { updates.push({ table, patch, ids, filters }); return resolve({ error: null }) }
          const data = table === 'tasks' ? (rows.tasks ?? []) : (rows.assignments ?? [])
          if (head) return resolve({ count: data.length, error: null })
          return resolve({ data, error: null })
        },
      }
      return b
    },
  }
  return admin
}

describe('deactivateClient', () => {
  test('archives every open task and deactivates every live assignment', async () => {
    const admin = makeAdmin({
      tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      assignments: [{ id: 'a1' }, { id: 'a2' }],
    })
    const r = await deactivateClient(admin, 'org-1', 'client-1')

    assert.equal(r.tasksArchived, 3)
    assert.equal(r.assignmentsDeactivated, 2)
    assert.deepEqual(r.taskIds, ['t1', 't2', 't3'])
    assert.deepEqual(r.assignmentIds, ['a1', 'a2'])

    const taskUpdate = admin.updates.find((u: any) => u.table === 'tasks')
    assert.equal(taskUpdate.patch.is_archived, true, 'archived, not deleted')
    assert.ok(taskUpdate.patch.deleted_at, 'given a deleted_at so it shows in Trash')

    const asgUpdate = admin.updates.find((u: any) => u.table === 'ca_client_assignments')
    assert.equal(asgUpdate.patch.is_active, false, 'compliance stops spawning')
  })

  test('a client with nothing open writes nothing', async () => {
    const admin = makeAdmin({ tasks: [], assignments: [] })
    const r = await deactivateClient(admin, 'org-1', 'client-1')
    assert.equal(r.tasksArchived, 0)
    assert.equal(r.assignmentsDeactivated, 0)
    assert.equal(admin.updates.length, 0, 'no empty .in() update is issued')
  })
})

describe('reactivateClient', () => {
  test('restores exactly the recorded ids', async () => {
    const admin = makeAdmin({})
    const r = await reactivateClient(admin, 'org-1', 'client-1', {
      [ARCHIVED_TASKS_KEY]:     ['t1', 't2'],
      [DEACTIVATED_ASSIGN_KEY]: ['a1'],
    })
    assert.equal(r.tasksRestored, 2)
    assert.equal(r.assignmentsReactivated, 1)

    const t = admin.updates.find((u: any) => u.table === 'tasks')
    assert.deepEqual(t.ids, ['t1', 't2'])
    assert.equal(t.patch.is_archived, false)
    assert.equal(t.patch.deleted_at, null, 'cleared, so it leaves Trash')
    assert.equal(t.filters.org_id, 'org-1')
    assert.equal(t.filters.client_id, 'client-1', 'a recorded id must still be this client’s')
  })

  test('a task deleted for some other reason is NOT swept back in', async () => {
    // The whole reason the ids are recorded. Reactivating a client is not an
    // undelete of everything that ever happened to it.
    const admin = makeAdmin({})
    await reactivateClient(admin, 'org-1', 'client-1', { [ARCHIVED_TASKS_KEY]: ['t1'] })
    const t = admin.updates.find((u: any) => u.table === 'tasks')
    assert.deepEqual(t.ids, ['t1'], 'only the one id, not a date range or a blanket restore')
  })

  test('no record, or a corrupt one, restores nothing rather than guessing', async () => {
    for (const stored of [null, {}, { [ARCHIVED_TASKS_KEY]: 't1' }, { [ARCHIVED_TASKS_KEY]: null }]) {
      const admin = makeAdmin({})
      const r = await reactivateClient(admin, 'org-1', 'client-1', stored as never)
      assert.equal(r.tasksRestored, 0)
      assert.equal(admin.updates.length, 0)
    }
  })
})

describe('previewDeactivation', () => {
  test('counts without writing anything', async () => {
    const admin = makeAdmin({
      tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      assignments: [{ id: 'a1' }],
    })
    const p = await previewDeactivation(admin, 'org-1', 'client-1')
    assert.equal(p.tasksArchived, 4)
    assert.equal(p.assignmentsDeactivated, 1)
    assert.equal(admin.updates.length, 0, 'a preview must never change anything')
  })
})
