import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planRollover, fyStartDate } from '../lib/ca/rollover.ts'
import type { MasterRef, AssignmentRef } from '../lib/ca/rollover.ts'

const m = (id: string, code: string, fy: string): MasterRef => ({ id, code, financial_year: fy })
const a = (o: Partial<AssignmentRef> & { master_task_id: string; client_id: string }): AssignmentRef => ({
  id: `asg-${Math.random().toString(36).slice(2)}`,
  assignee_id: 'u1', approver_id: null, end_date: null, is_active: true, ...o,
})

const OLD = [m('old-gst', 'GST-001', '2026-27'), m('old-tds', 'TDS-001', '2026-27')]
const NEW = [m('new-gst', 'GST-001', '2027-28'), m('new-tds', 'TDS-001', '2027-28')]

/* ── fyStartDate ─────────────────────────────────────────────────────────── */

test('a financial year resolves to 1 April of its first year', () => {
  assert.equal(fyStartDate('2027-28'), '2027-04-01')
  assert.equal(fyStartDate('2026-27'), '2026-04-01')
})

test('a year spanning a century rolls the two-digit half correctly', () => {
  assert.equal(fyStartDate('2099-00'), '2099-04-01')
})

test('a malformed or inconsistent year is rejected rather than guessed', () => {
  assert.equal(fyStartDate('2026-28'), null)   // halves do not follow on
  assert.equal(fyStartDate('2026'),    null)
  assert.equal(fyStartDate('FY26-27'), null)
  assert.equal(fyStartDate(''),        null)
})

test('an unparseable target year plans nothing at all', () => {
  const plan = planRollover([a({ master_task_id: 'old-gst', client_id: 'c1' })], OLD, NEW, [], 'rubbish')
  assert.equal(plan.create.length, 0)
})

/* ── the normal case ─────────────────────────────────────────────────────── */

test('an active assignment is carried to the matching task in the new year', () => {
  const plan = planRollover([a({ master_task_id: 'old-gst', client_id: 'c1' })], OLD, NEW, [], '2027-28')
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].to_master_id, 'new-gst')
  assert.equal(plan.create[0].client_id, 'c1')
})

test('matching is by code, so the id changing every year does not matter', () => {
  // Same code, completely different ids — that is the whole point.
  assert.equal(planRollover([a({ master_task_id: 'old-tds', client_id: 'c1' })], OLD, NEW, [], '2027-28')
    .create[0].to_master_id, 'new-tds')
})

test('assignee and approver are carried across', () => {
  const plan = planRollover(
    [a({ master_task_id: 'old-gst', client_id: 'c1', assignee_id: 'u7', approver_id: 'u9' })],
    OLD, NEW, [], '2027-28')
  assert.equal(plan.create[0].assignee_id, 'u7')
  assert.equal(plan.create[0].approver_id, 'u9')
})

/* ── start_date: the subtle one ──────────────────────────────────────────── */

test('start_date is pinned to 1 April, not left for created_at to fill', () => {
  // If this were null, the spawner would fall back to the assignment's
  // created_at — the day the rollover was run. Roll over in June and April
  // and May would be treated as "before the client started" and never created.
  const plan = planRollover([a({ master_task_id: 'old-gst', client_id: 'c1' })], OLD, NEW, [], '2027-28')
  assert.equal(plan.create[0].start_date, '2027-04-01')
})

/* ── what must NOT be carried ────────────────────────────────────────────── */

test('a paused assignment is not carried, or it would quietly resume', () => {
  const plan = planRollover(
    [a({ master_task_id: 'old-gst', client_id: 'c1', is_active: false })], OLD, NEW, [], '2027-28')
  assert.equal(plan.create.length, 0)
  assert.equal(plan.skipped[0].reason, 'inactive')
})

test('a client wound down before the new year starts is not carried', () => {
  const plan = planRollover(
    [a({ master_task_id: 'old-gst', client_id: 'c1', end_date: '2027-01-31' })], OLD, NEW, [], '2027-28')
  assert.equal(plan.create.length, 0)
  assert.equal(plan.skipped[0].reason, 'ended')
})

test('an end date INSIDE the new year is carried, not dropped', () => {
  const plan = planRollover(
    [a({ master_task_id: 'old-gst', client_id: 'c1', end_date: '2027-09-30' })], OLD, NEW, [], '2027-28')
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].end_date, '2027-09-30')
})

test('a task missing from the new calendar is reported, never invented', () => {
  const plan = planRollover(
    [a({ master_task_id: 'old-tds', client_id: 'c1' })], OLD, [NEW[0]], [], '2027-28')
  assert.equal(plan.create.length, 0)
  assert.equal(plan.skipped[0].reason, 'no_matching_task')
})

/* ── idempotency ─────────────────────────────────────────────────────────── */

test('running it twice creates nothing the second time', () => {
  const assignments = [a({ master_task_id: 'old-gst', client_id: 'c1' })]
  const first = planRollover(assignments, OLD, NEW, [], '2027-28')
  assert.equal(first.create.length, 1)

  const nowExisting = [a({ master_task_id: 'new-gst', client_id: 'c1' })]
  const second = planRollover(assignments, OLD, NEW, nowExisting, '2027-28')
  assert.equal(second.create.length, 0)
  assert.equal(second.skipped[0].reason, 'already_assigned')
})

test('another client having the task does not block this one', () => {
  const plan = planRollover(
    [a({ master_task_id: 'old-gst', client_id: 'c1' })],
    OLD, NEW,
    [a({ master_task_id: 'new-gst', client_id: 'c2' })],   // different client
    '2027-28')
  assert.equal(plan.create.length, 1)
})

test('assignments belonging to a different year are ignored entirely', () => {
  const plan = planRollover(
    [a({ master_task_id: 'some-other-year', client_id: 'c1' })], OLD, NEW, [], '2027-28')
  assert.equal(plan.create.length, 0)
  assert.equal(plan.skipped.length, 0)   // not skipped — simply not in scope
})

test('a full year of several clients and tasks plans every pair once', () => {
  const assignments = [
    a({ master_task_id: 'old-gst', client_id: 'c1' }),
    a({ master_task_id: 'old-tds', client_id: 'c1' }),
    a({ master_task_id: 'old-gst', client_id: 'c2' }),
    a({ master_task_id: 'old-tds', client_id: 'c2' }),
  ]
  const plan = planRollover(assignments, OLD, NEW, [], '2027-28')
  assert.equal(plan.create.length, 4)
  assert.equal(new Set(plan.create.map(c => `${c.client_id}__${c.to_master_id}`)).size, 4)
  assert.ok(plan.create.every(c => c.start_date === '2027-04-01'))
})
