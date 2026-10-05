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
