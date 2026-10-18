import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  financialYearOf, isValidFinancialYear, previousFinancialYear,
  nextFinancialYear, financialYearOptions,
} from '../lib/ca/financialYear.ts'

/* ── which year a date belongs to ────────────────────────────────────────── */

test('April starts a new financial year', () => {
  assert.equal(financialYearOf('2026-04-01'), '2026-27')
  assert.equal(financialYearOf('2026-12-31'), '2026-27')
})

test('January to March belong to the year that began the previous April', () => {
  // The off-by-one this exists to stop people rewriting.
  assert.equal(financialYearOf('2027-01-15'), '2026-27')
  assert.equal(financialYearOf('2027-03-31'), '2026-27')
})

test('the year rolls on 1 April, not 1 January', () => {
  assert.equal(financialYearOf('2027-03-31'), '2026-27')
  assert.equal(financialYearOf('2027-04-01'), '2027-28')
})

test('a century boundary formats the second half correctly', () => {
  assert.equal(financialYearOf('2099-04-01'), '2099-00')
  assert.equal(financialYearOf('2100-03-31'), '2099-00')
})

test('an unparseable date yields empty rather than a wrong year', () => {
  assert.equal(financialYearOf('rubbish'), '')
  assert.equal(financialYearOf(''), '')
})

/* ── validation ─────────────────────────────────────────────────────────── */

test('a well-formed label with consecutive halves is valid', () => {
  assert.ok(isValidFinancialYear('2026-27'))
  assert.ok(isValidFinancialYear('2099-00'))
})

test('halves that do not follow on are rejected', () => {
  // '2026-28' is a typo, not a range.
  assert.ok(!isValidFinancialYear('2026-28'))
  assert.ok(!isValidFinancialYear('2026-26'))
})

test('malformed labels are rejected', () => {
  for (const v of ['2026', 'FY26-27', '26-27', '', null, undefined, 202627]) {
    assert.ok(!isValidFinancialYear(v), `accepted ${String(v)}`)
  }
})

/* ── stepping ───────────────────────────────────────────────────────────── */

test('stepping back and forward crosses years correctly', () => {
  assert.equal(previousFinancialYear('2026-27'), '2025-26')
  assert.equal(nextFinancialYear('2026-27'), '2027-28')
})

test('stepping over a century boundary keeps the two-digit half right', () => {
  assert.equal(nextFinancialYear('2099-00'), '2100-01')
  assert.equal(previousFinancialYear('2100-01'), '2099-00')
})

test('stepping forward then back returns to the same year', () => {
  for (const fy of ['2025-26', '2026-27', '2099-00']) {
    assert.equal(previousFinancialYear(nextFinancialYear(fy)), fy)
  }
})

test('an invalid year is returned unchanged rather than mangled', () => {
  assert.equal(nextFinancialYear('rubbish'), 'rubbish')
  assert.equal(previousFinancialYear('2026-28'), '2026-28')
})

/* ── selector options ───────────────────────────────────────────────────── */

test('the selector offers last year, this year and next', () => {
  assert.deepEqual(financialYearOptions('2026-10-18'), ['2025-26', '2026-27', '2027-28'])
})

test('the options always contain the current year, whatever the date', () => {
  // The hardcoded list this replaces would have stopped containing the
  // current year in April 2028 — the dropdown would not have held the year
  // the firm was working in.
  for (const d of ['2026-04-01', '2028-07-09', '2031-02-28', '2099-12-31']) {
    const opts = financialYearOptions(d)
    assert.ok(opts.includes(financialYearOf(d)), `missing current year for ${d}`)
    assert.equal(opts.length, 3)
  }
})

test('every option is itself a valid financial year', () => {
  for (const d of ['2026-10-18', '2099-04-01']) {
    for (const fy of financialYearOptions(d)) {
      assert.ok(isValidFinancialYear(fy), `${fy} is not valid`)
    }
  }
})
