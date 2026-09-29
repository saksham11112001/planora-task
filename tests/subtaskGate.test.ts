import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockingSubtasks, subtaskGateMessage } from '../lib/utils/subtaskGate.ts'
import type { SubtaskRow } from '../lib/utils/subtaskGate.ts'

const sub = (o: Partial<SubtaskRow> = {}): SubtaskRow => ({
  id: Math.random().toString(36).slice(2),
  title: 'Sales Accounting',
  status: 'completed',
  is_archived: false,
  custom_fields: {},
  ...o,
})

test('a deleted subtask does not block its parent', () => {
  // The reported bug: the panel showed 4/4 because the list endpoint hides
  // archived rows, while the gate counted the deleted one and said "1 remaining".
  const rows = [
    sub(), sub(), sub(), sub(),
    sub({ status: 'todo', is_archived: true, title: 'Deleted step' }),
  ]
  assert.deepEqual(blockingSubtasks(rows), [])
})

test('is_archived null is treated as not archived, not as unknown', () => {
  // `.neq('is_archived', true)` in SQL drops NULL rows because NULL <> true is
  // NULL. The JS check must not inherit that: a NULL here means "never set",
  // i.e. live, and an unfinished live subtask must still block.
  const rows = [sub({ status: 'todo', is_archived: null, title: 'Live step' })]
  assert.equal(blockingSubtasks(rows).length, 1)
  assert.equal(blockingSubtasks(rows)[0].title, 'Live step')
})

test('compliance placeholders never block', () => {
  const rows = [sub({ status: 'todo', custom_fields: { _compliance_subtask: true } })]
  assert.deepEqual(blockingSubtasks(rows), [])
})

test('a genuinely unfinished subtask still blocks', () => {
  const rows = [sub(), sub({ status: 'todo', title: 'Day Book Accounting' })]
  const out = blockingSubtasks(rows)
  assert.equal(out.length, 1)
  assert.equal(out[0].title, 'Day Book Accounting')
})

test('in_review counts as unfinished', () => {
  assert.equal(blockingSubtasks([sub({ status: 'in_review' })]).length, 1)
})

test('all complete means nothing blocks', () => {
  assert.deepEqual(blockingSubtasks([sub(), sub(), sub(), sub()]), [])
})

test('empty and null inputs are safe', () => {
  assert.deepEqual(blockingSubtasks([]), [])
  assert.deepEqual(blockingSubtasks(null), [])
  assert.deepEqual(blockingSubtasks(undefined), [])
})

test('the message names what is outstanding', () => {
  const msg = subtaskGateMessage([sub({ status: 'todo', title: 'Day Book Accounting' })])
  assert.match(msg, /Day Book Accounting/)
})

test('the message caps the list and counts the rest', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map(t => sub({ status: 'todo', title: t }))
  const msg = subtaskGateMessage(rows)
  assert.match(msg, /a, b, c/)
  assert.match(msg, /and 2 more/)
  assert.ok(!msg.includes(' d,'), 'should not list the fourth')
})

test('the message explains an invisible blocker', () => {
  // A non-manager cannot see a colleague's subtask in the list, so the message
  // has to say why the count disagrees with what is on screen.
  const msg = subtaskGateMessage([sub({ status: 'todo', title: 'Bank Reco' })])
  assert.match(msg, /belongs to a colleague/)
})

test('falls back to a count when titles are missing', () => {
  const msg = subtaskGateMessage([sub({ status: 'todo', title: null })])
  assert.match(msg, /1 remaining/)
})
