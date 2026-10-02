import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  workingDaysBetween, leaveDaysCount, workedHours, rangesOverlap, isIsoDate,
} from '../lib/attendance/index.ts'

/* ── isIsoDate ───────────────────────────────────────────────────────────── */

test('isIsoDate accepts a real date and rejects a plausible-looking fake', () => {
  assert.equal(isIsoDate('2026-02-28'), true)
  // The trap: new Date('2026-02-30') does not throw, it rolls over to 2 March.
  // Anything that only checks the shape would let this through.
  assert.equal(isIsoDate('2026-02-30'), false)
  assert.equal(isIsoDate('2026-13-01'), false)
  assert.equal(isIsoDate('26-01-01'),   false)
  assert.equal(isIsoDate(''),           false)
  assert.equal(isIsoDate(null),         false)
  assert.equal(isIsoDate(20260101),     false)
})

test('isIsoDate accepts a leap day in a leap year and rejects it otherwise', () => {
  assert.equal(isIsoDate('2028-02-29'), true)   // leap
  assert.equal(isIsoDate('2026-02-29'), false)  // not leap
})

/* ── workingDaysBetween ──────────────────────────────────────────────────── */

test('a single weekday counts as one day', () => {
  // 2026-10-05 is a Monday.
  assert.equal(workingDaysBetween('2026-10-05', '2026-10-05'), 1)
})

test('a single weekend day counts as zero', () => {
  // 2026-10-03 Saturday, 2026-10-04 Sunday.
  assert.equal(workingDaysBetween('2026-10-03', '2026-10-03'), 0)
  assert.equal(workingDaysBetween('2026-10-04', '2026-10-04'), 0)
})

test('a full Monday-to-Friday week is five days', () => {
  assert.equal(workingDaysBetween('2026-10-05', '2026-10-09'), 5)
})

test('a range spanning a weekend excludes it', () => {
  // Fri 9th to Mon 12th = Fri + Mon.
  assert.equal(workingDaysBetween('2026-10-09', '2026-10-12'), 2)
})

test('two full weeks are ten working days', () => {
  assert.equal(workingDaysBetween('2026-10-05', '2026-10-16'), 10)
})

test('a reversed range counts zero rather than looping or going negative', () => {
  assert.equal(workingDaysBetween('2026-10-09', '2026-10-05'), 0)
})

test('an invalid date counts zero instead of throwing', () => {
  assert.equal(workingDaysBetween('not-a-date', '2026-10-05'), 0)
  assert.equal(workingDaysBetween('2026-02-30', '2026-03-05'), 0)
})

test('the count does not depend on the host timezone', () => {
  // The helper iterates in UTC. If it used local getDay(), a host in
  // Pacific/Kiritimati (UTC+14) would shift the weekday and miscount.
  const tz = process.env.TZ
  try {
    process.env.TZ = 'Pacific/Kiritimati'
    assert.equal(workingDaysBetween('2026-10-05', '2026-10-09'), 5)
    process.env.TZ = 'Pacific/Midway'
    assert.equal(workingDaysBetween('2026-10-05', '2026-10-09'), 5)
  } finally {
    if (tz === undefined) delete process.env.TZ
    else process.env.TZ = tz
  }
})

/* ── leaveDaysCount ──────────────────────────────────────────────────────── */

test('a half day on one date is 0.5', () => {
  assert.equal(leaveDaysCount('2026-10-05', '2026-10-05', true), 0.5)
})

test('a half day across a range is rejected as zero', () => {
  // The API refuses this outright; the helper must not quietly pick a half.
  assert.equal(leaveDaysCount('2026-10-05', '2026-10-07', true), 0)
})

test('a normal range falls through to the working-day count', () => {
  assert.equal(leaveDaysCount('2026-10-05', '2026-10-09', false), 5)
})

/* ── workedHours ─────────────────────────────────────────────────────────── */

test('worked hours are null while still checked in', () => {
  assert.equal(workedHours({ check_in_at: '2026-10-05T09:00:00Z', check_out_at: null }), null)
})

test('worked hours round to one decimal', () => {
  assert.equal(
    workedHours({ check_in_at: '2026-10-05T09:00:00Z', check_out_at: '2026-10-05T17:30:00Z' }),
    8.5,
  )
})

test('a check-out before check-in yields null, not a negative shift', () => {
  assert.equal(
    workedHours({ check_in_at: '2026-10-05T17:00:00Z', check_out_at: '2026-10-05T09:00:00Z' }),
    null,
  )
})

/* ── rangesOverlap ───────────────────────────────────────────────────────── */

test('ranges that touch on a single day overlap', () => {
  assert.equal(rangesOverlap('2026-10-05', '2026-10-07', '2026-10-07', '2026-10-09'), true)
})

test('adjacent but non-touching ranges do not overlap', () => {
  assert.equal(rangesOverlap('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'), false)
})

test('a range fully inside another overlaps', () => {
  assert.equal(rangesOverlap('2026-10-01', '2026-10-31', '2026-10-10', '2026-10-12'), true)
})
