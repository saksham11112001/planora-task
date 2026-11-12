/**
 * Marking a client inactive archives its open work and stops its compliance
 * spawning; reactivating puts back exactly that and nothing else.
 *
 * The "nothing else" half is the one worth testing. A reactivation that also
 * un-deleted tasks the firm removed on purpose would be worse than one that
 * restored nothing.
 *
 * The stub also asserts WHICH TABLES ARE READ. The first version of this
 * feature selected clients.custom_fields, a column that does not exist; the
 * select failed, the null result was reported as "Client not found", and every
 * client save broke in production. A stub that only answered happily could
 * never have caught it, so the column list is checked here.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  statusChange, deactivateClient, reactivateClient, previewDeactivation,
  ARCHIVED_WITH_CLIENT,
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

/* ── the database work ───────────────────────────────────────────────────── */

interface StubTask { id: string; custom_fields?: Record<string, unknown> | null }

/**
 * Chainable stub recording every update AND every column selected, so a read
 * of a column that does not exist shows up as a test failure rather than a
 * production 404.
 */
function makeAdmin(rows: { tasks?: StubTask[]; assignments?: { id: string }[] }) {
  const updates: { table: string; patch: Record<string, unknown>; id?: string; ids: string[] }[] = []
  const selects: { table: string; columns: string }[] = []
  const admin: any = {
    updates, selects,
    from(table: string) {
      let op: 'select' | 'update' = 'select'
      let patch: Record<string, unknown> = {}
      let ids: string[] = []
      let one: string | undefined
      let head = false
      const b: any = {
        select: (cols?: string, o?: { head?: boolean }) => {
          selects.push({ table, columns: cols ?? '' })
          if (o?.head) head = true
          return b
        },
        update:   (p: Record<string, unknown>) => { op = 'update'; patch = p; return b },
        in:       (_c: string, v: string[]) => { ids = v; return b },
        eq:       (c: string, v: unknown) => { if (c === 'id') one = v as string; return b },
        not:      () => b,
        or:       () => b,
        contains: () => b,
        then: (resolve: (v: unknown) => void) => {
          if (op === 'update') { updates.push({ table, patch, id: one, ids }); return resolve({ error: null }) }
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

    const t = admin.updates.find((u: any) => u.table === 'tasks')
    assert.equal(t.patch.is_archived, true, 'archived, not deleted')
    assert.ok(t.patch.deleted_at, 'given a deleted_at so it shows in Trash')
    assert.equal((t.patch.custom_fields as any)[ARCHIVED_WITH_CLIENT], true, 'flagged for restore')

    const a = admin.updates.find((u: any) => u.table === 'ca_client_assignments')
    assert.equal(a.patch.is_active, false, 'compliance stops spawning')
  })

  test('NEVER reads a column clients does not have', async () => {
    // The production bug: selecting clients.custom_fields returned null, which
    // was reported as "Client not found" and broke every client save.
    const admin = makeAdmin({ tasks: [{ id: 't1' }], assignments: [] })
    await deactivateClient(admin, 'org-1', 'client-1')
    assert.equal(admin.selects.some((s: any) => s.table === 'clients'), false,
      'deactivation must not depend on reading the clients row at all')
  })

  test('existing custom_fields survive — _ca_compliance is not clobbered', async () => {
    const admin = makeAdmin({
      tasks: [{ id: 't1', custom_fields: { _ca_compliance: true, _assignment_id: 'x' } }],
    })
    await deactivateClient(admin, 'org-1', 'client-1')
    const cf = admin.updates[0].patch.custom_fields as Record<string, unknown>
    assert.equal(cf._ca_compliance, true, 'the compliance flag must not be lost')
    assert.equal(cf._assignment_id, 'x')
    assert.equal(cf[ARCHIVED_WITH_CLIENT], true)
  })

  test('a null or malformed custom_fields does not throw', async () => {
    const admin = makeAdmin({ tasks: [{ id: 't1', custom_fields: null }, { id: 't2', custom_fields: [] as never }] })
    const r = await deactivateClient(admin, 'org-1', 'client-1')
    assert.equal(r.tasksArchived, 2)
    for (const u of admin.updates) {
      assert.equal((u.patch.custom_fields as any)[ARCHIVED_WITH_CLIENT], true)
    }
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
  test('restores the flagged tasks and clears the flag', async () => {
    const admin = makeAdmin({
      tasks: [{ id: 't1', custom_fields: { [ARCHIVED_WITH_CLIENT]: true, _ca_compliance: true } }],
      assignments: [{ id: 'a1' }],
    })
    const r = await reactivateClient(admin, 'org-1', 'client-1')
    assert.equal(r.tasksRestored, 1)
    assert.equal(r.assignmentsReactivated, 1)

    const t = admin.updates.find((u: any) => u.table === 'tasks')
    assert.equal(t.patch.is_archived, false)
    assert.equal(t.patch.deleted_at, null, 'cleared, so it leaves Trash')
    const cf = t.patch.custom_fields as Record<string, unknown>
    assert.equal(ARCHIVED_WITH_CLIENT in cf, false, 'flag cleared for a clean second round')
    assert.equal(cf._ca_compliance, true, 'everything else survives')
  })

  test('restores nothing when no task carries the flag', async () => {
    // A task the firm deleted by hand is not part of the engagement coming
    // back. Reactivating a client is not an undelete.
    const admin = makeAdmin({ tasks: [], assignments: [] })
    const r = await reactivateClient(admin, 'org-1', 'client-1')
    assert.equal(r.tasksRestored, 0)
    assert.equal(admin.updates.length, 0)
  })

  test('does not read the clients row either', async () => {
    const admin = makeAdmin({ tasks: [{ id: 't1' }] })
    await reactivateClient(admin, 'org-1', 'client-1')
    assert.equal(admin.selects.some((s: any) => s.table === 'clients'), false)
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
