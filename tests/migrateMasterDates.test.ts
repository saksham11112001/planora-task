import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffDates } from '../lib/ca/migrateMasterDates.ts'

test('no change produces nothing to migrate', () => {
  assert.deepEqual(diffDates({ oct: '2026-10-31' }, { oct: '2026-10-31' }), [])
})

test('a date moving within the same month is detected', () => {
  assert.deepEqual(
    diffDates({ oct: '2026-10-31' }, { oct: '2026-10-15' }),
    [{ monthKey: 'oct', old: '2026-10-31', new: '2026-10-15' }],
  )
})

test('THE LIVE INCIDENT: a date moving across a month boundary is detected', () => {
  // 29 Sep 2026: "ITR (with Audit)" went from {oct: 2026-10-31} to
  // {nov: 2026-11-21}. One obligation moving reads as one key disappearing
  // and another appearing. Missing this is what left 44 tasks on the old date
  // and let the nightly spawner create 40 duplicates.
  assert.deepEqual(
    diffDates({ oct: '2026-10-31' }, { nov: '2026-11-21' }),
    [{ monthKey: 'nov', old: '2026-10-31', new: '2026-11-21' }],
  )
})

test('a brand new month is NOT a move', () => {
  // Nothing has been spawned for it, so there is nothing to migrate.
  assert.deepEqual(diffDates({ oct: '2026-10-31' }, { oct: '2026-10-31', dec: '2026-12-31' }), [])
})

test('a removed month alone is not treated as a move', () => {
  assert.deepEqual(diffDates({ oct: '2026-10-31', dec: '2026-12-31' }, { oct: '2026-10-31' }), [])
})

test('ambiguous multi-key renames are left alone rather than guessed', () => {
  // Two keys out and two in: pairing them would be a guess, and guessing wrong
  // moves a real statutory deadline to the wrong day.
  assert.deepEqual(
    diffDates({ oct: '2026-10-31', jul: '2026-07-31' }, { nov: '2026-11-21', aug: '2026-08-31' }),
    [],
  )
})

test('several months changing in place are all returned', () => {
  const out = diffDates(
    { jul: '2026-07-31', oct: '2026-10-31' },
    { jul: '2026-07-15', oct: '2026-10-20' },
  )
  assert.equal(out.length, 2)
  assert.deepEqual(out.find(c => c.monthKey === 'jul'), { monthKey: 'jul', old: '2026-07-31', new: '2026-07-15' })
  assert.deepEqual(out.find(c => c.monthKey === 'oct'), { monthKey: 'oct', old: '2026-10-31', new: '2026-10-20' })
})

test('malformed dates are ignored rather than written to the database', () => {
  assert.deepEqual(diffDates({ oct: '2026-10-31' }, { oct: 'not-a-date' }), [])
  assert.deepEqual(diffDates({ oct: 'rubbish' },    { oct: '2026-11-21' }), [])
  assert.deepEqual(diffDates({ oct: '2026-10-31' }, { oct: '' }), [])
})

test('null and undefined maps do not throw', () => {
  assert.deepEqual(diffDates(null, null), [])
  assert.deepEqual(diffDates(undefined, { oct: '2026-10-31' }), [])
  assert.deepEqual(diffDates({ oct: '2026-10-31' }, null), [])
})

/* ── migrateMasterDates: the dedup row must not outrun its task ───────────── */

/**
 * Chainable stand-in for the PostgREST builder. Every filter returns `this`;
 * awaiting resolves to whatever the scenario configured for that table and
 * operation. Records each update so the test can assert what was written.
 */
function makeAdmin(scenario: {
  assignments: { id: string }[]
  instances:   { id: string; task_id: string | null; assignment_id: string }[]
  movedTasks:  { id: string }[]
}) {
  const instanceUpdates: { id: string; patch: Record<string, unknown> }[] = []
  const admin = {
    instanceUpdates,
    from(table: string) {
      let op: 'select' | 'update' = 'select'
      let patch: Record<string, unknown> = {}
      let eqId: string | null = null
      const builder: any = {
        select: () => builder,
        update: (p: Record<string, unknown>) => { op = 'update'; patch = p; return builder },
        in:     () => builder,
        not:    () => builder,
        or:     () => builder,
        eq: (col: string, val: unknown) => {
          if (col === 'id') eqId = val as string
          return builder
        },
        then: (resolve: (v: unknown) => void) => {
          if (table === 'ca_client_assignments') return resolve({ data: scenario.assignments, error: null })
          if (table === 'ca_task_instances') {
            if (op === 'update') {
              instanceUpdates.push({ id: eqId!, patch })
              return resolve({ data: null, error: null })
            }
            return resolve({ data: scenario.instances, error: null })
          }
          if (table === 'tasks') return resolve({ data: scenario.movedTasks, error: null })
          return resolve({ data: [], error: null })
        },
      }
      return builder
    },
  }
  return admin
}

const CHANGE = [{ monthKey: 'oct', old: '2025-10-31', new: '2026-10-31' }]

test('THE HVAT INCIDENT: a deleted task does not drag its spawn record forward', async () => {
  // The task was archived in April, so step 1 leaves it on 2025-10-31. If the
  // dedup row still advanced to 2026-10-31, the spawner would see the 2026
  // occurrence as already created and never make it — which is exactly what
  // happened to HVAT (Return) for every client of one firm.
  const admin = makeAdmin({
    assignments: [{ id: 'asg-1' }],
    instances:   [{ id: 'inst-1', task_id: 'task-archived', assignment_id: 'asg-1' }],
    movedTasks:  [],      // nothing moved: the task is archived
  })
  const { migrateMasterDates } = await import('../lib/ca/migrateMasterDates.ts')
  const res = await migrateMasterDates(admin as never, 'org-1', 'master-1', CHANGE)

  assert.equal(admin.instanceUpdates.length, 0, 'the spawn record must stay on the old date')
  assert.equal(res.instancesMoved, 0)
  assert.equal(res.instancesLeft, 1)
  assert.equal(res.tasksMoved, 0)
})

test('a task that really moved still takes its spawn record with it', async () => {
  // The duplicate-prevention the re-point exists for must keep working.
  const admin = makeAdmin({
    assignments: [{ id: 'asg-1' }],
    instances:   [{ id: 'inst-1', task_id: 'task-live', assignment_id: 'asg-1' }],
    movedTasks:  [{ id: 'task-live' }],
  })
  const { migrateMasterDates } = await import('../lib/ca/migrateMasterDates.ts')
  const res = await migrateMasterDates(admin as never, 'org-1', 'master-1', CHANGE)

  assert.equal(admin.instanceUpdates.length, 1)
  assert.equal(admin.instanceUpdates[0].id, 'inst-1')
  assert.equal(admin.instanceUpdates[0].patch.due_date, '2026-10-31')
  assert.equal(res.instancesMoved, 1)
  assert.equal(res.instancesLeft, 0)
})

test('a mix moves only the records whose tasks moved', async () => {
  const admin = makeAdmin({
    assignments: [{ id: 'asg-1' }, { id: 'asg-2' }, { id: 'asg-3' }],
    instances: [
      { id: 'inst-live',     task_id: 'task-live',     assignment_id: 'asg-1' },
      { id: 'inst-archived', task_id: 'task-archived', assignment_id: 'asg-2' },
      { id: 'inst-orphan',   task_id: null,            assignment_id: 'asg-3' },
    ],
    movedTasks: [{ id: 'task-live' }],
  })
  const { migrateMasterDates } = await import('../lib/ca/migrateMasterDates.ts')
  const res = await migrateMasterDates(admin as never, 'org-1', 'master-1', CHANGE)

  assert.deepEqual(admin.instanceUpdates.map(u => u.id), ['inst-live'])
  assert.equal(res.instancesMoved, 1)
  assert.equal(res.instancesLeft, 2, 'archived and orphaned records both stay put')
})

test('an orphaned record (no task at all) is never advanced', async () => {
  // Nothing to move, so advancing it would block the new occurrence for ever.
  const admin = makeAdmin({
    assignments: [{ id: 'asg-1' }],
    instances:   [{ id: 'inst-1', task_id: null, assignment_id: 'asg-1' }],
    movedTasks:  [],
  })
  const { migrateMasterDates } = await import('../lib/ca/migrateMasterDates.ts')
  const res = await migrateMasterDates(admin as never, 'org-1', 'master-1', CHANGE)
  assert.equal(admin.instanceUpdates.length, 0)
  assert.equal(res.instancesLeft, 1)
})
