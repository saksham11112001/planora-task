import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseStatus, normalisePortal, isOverdue, isDueSoon } from '../lib/notices/index.ts'

/* ── normaliseStatus ─────────────────────────────────────────────────────── */

test('both spellings that exist in production fold to one key', () => {
  // The per-client UI writes Title Case; the column default is snake_case.
  // Real rows exist in both shapes because there is no CHECK constraint.
  assert.equal(normaliseStatus('Action Pending'), 'action_pending')
  assert.equal(normaliseStatus('action_pending'), 'action_pending')
  assert.equal(normaliseStatus('Response Filed'), 'response_filed')
  assert.equal(normaliseStatus('response_filed'), 'response_filed')
  assert.equal(normaliseStatus('Closed'),         'closed')
  assert.equal(normaliseStatus('closed'),         'closed')
})

test('odd spacing and hyphens still fold', () => {
  assert.equal(normaliseStatus('  action-pending '), 'action_pending')
  assert.equal(normaliseStatus('RESPONSE  FILED'),   'response_filed')
})

test('an unknown status is treated as open, not dropped', () => {
  // Defaulting to 'closed' would make an unrecognised notice vanish from the
  // list it most needs to be on.
  assert.equal(normaliseStatus('whatever'), 'action_pending')
  assert.equal(normaliseStatus(null),       'action_pending')
  assert.equal(normaliseStatus(undefined),  'action_pending')
  assert.equal(normaliseStatus(''),         'action_pending')
})

/* ── normalisePortal ─────────────────────────────────────────────────────── */

test('portal spellings fold and unknowns become other', () => {
  assert.equal(normalisePortal('Income Tax'), 'income_tax')
  assert.equal(normalisePortal('income_tax'), 'income_tax')
  assert.equal(normalisePortal('GST'),        'gst')
  assert.equal(normalisePortal('TRACES'),     'traces')
  assert.equal(normalisePortal('SomePortal'), 'other')
  assert.equal(normalisePortal(null),         'other')
})

/* ── isOverdue ───────────────────────────────────────────────────────────── */

const TODAY = '2026-10-02'

test('a notice due before today and still open is overdue', () => {
  assert.equal(isOverdue({ response_due: '2026-10-01', status: 'action_pending' }, TODAY), true)
})

test('a notice due today is NOT overdue', () => {
  // You still have the day to respond.
  assert.equal(isOverdue({ response_due: TODAY, status: 'action_pending' }, TODAY), false)
})

test('a closed notice is never overdue, in either spelling', () => {
  assert.equal(isOverdue({ response_due: '2026-01-01', status: 'closed' }, TODAY), false)
  assert.equal(isOverdue({ response_due: '2026-01-01', status: 'Closed' }, TODAY), false)
})

test('a notice with no deadline is never overdue', () => {
  assert.equal(isOverdue({ response_due: null, status: 'action_pending' }, TODAY), false)
})

/* ── isDueSoon ───────────────────────────────────────────────────────────── */

test('due soon covers today through the window end, inclusive', () => {
  assert.equal(isDueSoon({ response_due: TODAY,        status: 'action_pending' }, TODAY, 7), true)
  assert.equal(isDueSoon({ response_due: '2026-10-09', status: 'action_pending' }, TODAY, 7), true)
  assert.equal(isDueSoon({ response_due: '2026-10-10', status: 'action_pending' }, TODAY, 7), false)
})

test('an overdue notice is not also counted as due soon', () => {
  // The two buckets must not double-count, or the summary adds up to more
  // notices than exist.
  assert.equal(isDueSoon({ response_due: '2026-09-30', status: 'action_pending' }, TODAY, 7), false)
})

test('due soon crosses a month boundary correctly', () => {
  assert.equal(isDueSoon({ response_due: '2026-11-02', status: 'action_pending' }, '2026-10-28', 7), true)
  assert.equal(isDueSoon({ response_due: '2026-11-05', status: 'action_pending' }, '2026-10-28', 7), false)
})
