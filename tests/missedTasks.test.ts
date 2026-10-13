import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyOccurrence, withinGraceWindow, SPAWN_GRACE_DAYS, BENIGN_STATUSES,
} from '../lib/ca/missedTasks.ts'

const base = {
  startDate: '2026-04-01',
  endDate:   null as string | null,
  daysBeforeDue: 7,
  exists: false,
  today: '2026-10-09',
}

test('an existing task is never a problem', () => {
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-05-07', exists: true }), 'present')
})

test('existence wins over every date rule', () => {
  // A task created before someone later set a start date must not be reported
  // as "before start" — that explains an absence that is not absent.
  assert.equal(
    classifyOccurrence({ ...base, dueDate: '2026-01-01', startDate: '2026-04-01', exists: true }),
    'present',
  )
})

test('THE 529: a date before the client started is not a failure', () => {
  // This is the case that made a firm's report say 562 missing when the real
  // number was 33.
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-03-11', startDate: '2026-07-11' }), 'before_start')
})

test('a date after the client end date is not a failure', () => {
  assert.equal(
    classifyOccurrence({ ...base, dueDate: '2026-09-30', endDate: '2026-07-31' }),
    'after_end',
  )
})

test('a future occurrence whose trigger date has not arrived is waiting, not missing', () => {
  // Due 2026-12-31, created 7 days before = 2026-12-24, today is 2026-10-09.
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-12-31' }), 'not_due_yet')
})

test('an occurrence inside its trigger window but not created IS missing', () => {
  // Due 2026-10-13, 7 days before = 2026-10-06, which has passed.
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-10-13' }), 'missed')
})

test('a past date with no task is missing', () => {
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-09-24' }), 'missed')
})

test('the boundary: trigger date exactly today counts as due', () => {
  // Due 2026-10-16, minus 7 = 2026-10-09 = today. Not "not_due_yet".
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-10-16' }), 'missed')
  // One day later is still waiting.
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-10-17' }), 'not_due_yet')
})

test('due date equal to the start date is in scope, not before it', () => {
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-07-11', startDate: '2026-07-11' }), 'missed')
})

test('due date equal to the end date is in scope, not after it', () => {
  assert.equal(
    classifyOccurrence({ ...base, dueDate: '2026-07-31', endDate: '2026-07-31' }),
    'missed',
  )
})

test('zero or missing daysBeforeDue does not break the trigger maths', () => {
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-10-09', daysBeforeDue: 0 }), 'missed')
  assert.equal(classifyOccurrence({ ...base, dueDate: '2026-10-09', daysBeforeDue: -5 }), 'missed')
})

test('only "missed" is treated as a problem', () => {
  assert.equal(BENIGN_STATUSES.includes('missed' as never), false)
  assert.equal(BENIGN_STATUSES.length, 4)
})

/* ── grace window ────────────────────────────────────────────────────────── */

test('the grace window reaches back exactly seven days, inclusive', () => {
  assert.equal(SPAWN_GRACE_DAYS, 7)
  assert.equal(withinGraceWindow('2026-10-02', '2026-10-09'), true)   // 7 days back
  assert.equal(withinGraceWindow('2026-10-01', '2026-10-09'), false)  // 8 days back
})

test('today and future dates are always inside the window', () => {
  assert.equal(withinGraceWindow('2026-10-09', '2026-10-09'), true)
  assert.equal(withinGraceWindow('2026-12-31', '2026-10-09'), true)
})

test('the window crosses a month boundary correctly', () => {
  assert.equal(withinGraceWindow('2026-09-28', '2026-10-03'), true)
  assert.equal(withinGraceWindow('2026-09-25', '2026-10-03'), false)
})

test('a months-old date is NOT back-filled', () => {
  // Deliberate: back-filling a year of history after a schedule change would
  // bury the team.
  assert.equal(withinGraceWindow('2026-05-07', '2026-10-09'), false)
})
