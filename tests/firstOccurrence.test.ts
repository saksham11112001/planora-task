import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstOccurrenceDate } from '../lib/utils/recurringSchedule.ts'

const TODAY = '2026-10-13'   // a Tuesday

test('an explicit date from the caller wins', () => {
  assert.equal(firstOccurrenceDate('monthly', '2026-11-01', '2026-12-25', TODAY), '2026-12-25')
})

test('the due date is the first run when no explicit date is given', () => {
  // For a repeat task the due date IS its first occurrence.
  assert.equal(firstOccurrenceDate('monthly', '2026-11-01', null, TODAY), '2026-11-01')
})

test('a past due date is respected rather than silently moved', () => {
  // The job back-fills or the user corrects it; guessing here would hide the
  // fact that the template was set up with a stale date.
  assert.equal(firstOccurrenceDate('weekly', '2026-09-19', null, TODAY), '2026-09-19')
})

test('THE BUG: with neither, it is computed instead of left NULL', () => {
  // A NULL next_occurrence_date is never selected by the daily job, because
  // `NULL <= today` is NULL rather than TRUE. The template never spawns.
  const got = firstOccurrenceDate('weekly', null, null, TODAY)
  assert.notEqual(got, null)
  assert.match(got!, /^\d{4}-\d{2}-\d{2}$/)
})

test('a schedule landing on today fires today, not a cycle later', () => {
  // Counting from yesterday is what makes today itself eligible — the same
  // thing PATCH does.
  assert.equal(firstOccurrenceDate('daily', null, null, TODAY), TODAY)
})

test('a weekly-on-Tuesday template created on a Tuesday fires that day', () => {
  assert.equal(firstOccurrenceDate('weekly_tue', null, null, TODAY), TODAY)
})

test('no frequency means there is nothing to compute', () => {
  assert.equal(firstOccurrenceDate(null, null, null, TODAY), null)
  assert.equal(firstOccurrenceDate(undefined, null, null, TODAY), null)
  assert.equal(firstOccurrenceDate('', null, null, TODAY), null)
})

test('an empty string is not mistaken for a date', () => {
  assert.equal(firstOccurrenceDate('monthly', '', '', TODAY), firstOccurrenceDate('monthly', null, null, TODAY))
})
