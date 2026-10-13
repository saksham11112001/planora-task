import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideSpawn } from '../lib/ca/spawnDecision.ts'
import type { SpawnInput } from '../lib/ca/spawnDecision.ts'

const base: SpawnInput = {
  dueDate: '2026-10-13', startDate: '2026-04-01', endDate: null,
  daysBeforeDue: 7, today: '2026-10-13', graceDays: 7,
  hasInstance: false, hasTask: false,
}
const d = (o: Partial<SpawnInput>) => decideSpawn({ ...base, ...o })

/* ── the happy path ──────────────────────────────────────────────────────── */

test('an occurrence inside its window with nothing created is spawned', () => {
  assert.deepEqual(d({}), { spawn: true })
})

/* ── P3: the divergence this file exists to remove ───────────────────────── */

test('an existing SPAWN RECORD stops it', () => {
  assert.deepEqual(d({ hasInstance: true }), { spawn: false, reason: 'already_exists' })
})

test('an existing TASK stops it too — this is what the cron used to miss', () => {
  // The cron checked only the spawn record, so a task whose record was
  // missing was re-attempted every night: the unique index rejected the
  // insert, no record was ever written, and it looped forever.
  assert.deepEqual(d({ hasTask: true }), { spawn: false, reason: 'already_exists' })
})

test('existence is checked before the date rules', () => {
  // Otherwise a task created before someone later set a start date reads as
  // "before_start" — explaining an absence that is not absent.
  assert.deepEqual(
    d({ hasTask: true, dueDate: '2026-01-01', startDate: '2026-04-01' }),
    { spawn: false, reason: 'already_exists' },
  )
})

/* ── client window ───────────────────────────────────────────────────────── */

test('before the client start date', () => {
  assert.deepEqual(d({ dueDate: '2026-03-11', startDate: '2026-07-11' }),
    { spawn: false, reason: 'before_start' })
})

test('due date equal to the start date is in scope', () => {
  assert.deepEqual(d({ dueDate: '2026-07-11', startDate: '2026-07-11', today: '2026-07-11' }),
    { spawn: true })
})

test('after the client end date', () => {
  assert.deepEqual(d({ dueDate: '2026-09-30', endDate: '2026-07-31' }),
    { spawn: false, reason: 'after_end' })
})

test('due date equal to the end date is in scope', () => {
  assert.deepEqual(d({ dueDate: '2026-10-13', endDate: '2026-10-13' }), { spawn: true })
})

/* ── trigger window ──────────────────────────────────────────────────────── */

test('a future occurrence whose trigger date has not arrived waits', () => {
  assert.deepEqual(d({ dueDate: '2026-12-31' }), { spawn: false, reason: 'not_due_yet' })
})

test('the boundary: trigger date exactly today is due', () => {
  // 2026-10-20 minus 7 = 2026-10-13 = today.
  assert.deepEqual(d({ dueDate: '2026-10-20' }), { spawn: true })
  assert.deepEqual(d({ dueDate: '2026-10-21' }), { spawn: false, reason: 'not_due_yet' })
})

test('zero or negative daysBeforeDue does not shift the window backwards', () => {
  assert.deepEqual(d({ dueDate: '2026-10-13', daysBeforeDue: 0 }),  { spawn: true })
  assert.deepEqual(d({ dueDate: '2026-10-13', daysBeforeDue: -5 }), { spawn: true })
  assert.deepEqual(d({ dueDate: '2026-10-14', daysBeforeDue: 0 }),
    { spawn: false, reason: 'not_due_yet' })
})

/* ── back-fill window ────────────────────────────────────────────────────── */

test('the nightly run reaches back exactly graceDays, inclusive', () => {
  assert.deepEqual(d({ dueDate: '2026-10-06', graceDays: 7 }), { spawn: true })
  assert.deepEqual(d({ dueDate: '2026-10-05', graceDays: 7 }),
    { spawn: false, reason: 'too_old' })
})

test('graceDays null means no limit — what "Spawn tasks now" is for', () => {
  assert.deepEqual(d({ dueDate: '2026-05-07', graceDays: null }), { spawn: true })
  // startDate moved back too: otherwise 'before_start' correctly wins first,
  // which is what the earlier version of this test actually proved.
  assert.deepEqual(d({ dueDate: '2025-01-01', startDate: '2024-04-01', graceDays: null }),
    { spawn: true })
})

test('graceDays 0 still allows today itself', () => {
  assert.deepEqual(d({ dueDate: '2026-10-13', graceDays: 0 }), { spawn: true })
  assert.deepEqual(d({ dueDate: '2026-10-12', graceDays: 0 }),
    { spawn: false, reason: 'too_old' })
})

/* ── precedence ──────────────────────────────────────────────────────────── */

test('a past occurrence outside the client window reports the window, not age', () => {
  // The client reason is the useful one; "too_old" would hide it.
  assert.deepEqual(d({ dueDate: '2026-01-01', startDate: '2026-04-01', graceDays: 7 }),
    { spawn: false, reason: 'before_start' })
})

test('the window crosses a month boundary correctly', () => {
  assert.deepEqual(d({ dueDate: '2026-09-28', today: '2026-10-03', graceDays: 7 }), { spawn: true })
  assert.deepEqual(d({ dueDate: '2026-09-25', today: '2026-10-03', graceDays: 7 }),
    { spawn: false, reason: 'too_old' })
})
