import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  financialYearOf, isValidFinancialYear, previousFinancialYear,
  nextFinancialYear, financialYearOptions, rebaseDatesToFy,
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

describe('rebaseDatesToFy', () => {
  test('April to December take the first half of the financial year', () => {
    assert.deepEqual(
      rebaseDatesToFy({ apr: '2020-04-13', oct: '2020-10-31', dec: '2020-12-31' }, '2026-27'),
      { apr: '2026-04-13', oct: '2026-10-31', dec: '2026-12-31' },
    )
  })

  test('January to March roll into the second half', () => {
    assert.deepEqual(
      rebaseDatesToFy({ jan: '2020-01-31', feb: '2020-02-14', mar: '2020-03-31' }, '2026-27'),
      { jan: '2027-01-31', feb: '2027-02-14', mar: '2027-03-31' },
    )
  })

  test('the HVAT (Return) regression: a stale year is corrected on load', () => {
    // Shipped as 2025 dates on an FY 2026-27 catalogue. Loaded verbatim, the
    // due date was a year past, so the spawner skipped it as 'too_old' every
    // night and the obligation never appeared for anyone.
    assert.deepEqual(
      rebaseDatesToFy({ jul: '2025-07-31', oct: '2025-10-31', jan: '2026-01-31' }, '2026-27'),
      { jul: '2026-07-31', oct: '2026-10-31', jan: '2027-01-31' },
    )
  })

  test('loading a future year no longer hands out this year’s dates', () => {
    assert.deepEqual(
      rebaseDatesToFy({ apr: '2026-04-13', mar: '2027-03-31' }, '2030-31'),
      { apr: '2030-04-13', mar: '2031-03-31' },
    )
  })

  test('the statutory day and month are never altered, only the year', () => {
    const src = { apr: '2026-04-01', oct: '2026-10-25', jan: '2027-01-07' }
    const out = rebaseDatesToFy(src, '2031-32')
    for (const k of Object.keys(src)) {
      assert.equal(out[k].slice(5), src[k as keyof typeof src].slice(5), `${k} kept its month-day`)
    }
  })

  test('the DATE’s month decides the year, not the map key', () => {
    // IEC renewal is filed under 'jun' with a July date. Trusting the key
    // would move a July date by a year whenever the key disagreed.
    assert.deepEqual(rebaseDatesToFy({ jun: '2026-07-31' }, '2026-27'), { jun: '2026-07-31' })
    assert.deepEqual(rebaseDatesToFy({ oct: '2025-07-31' }, '2026-27'), { oct: '2026-07-31' })
  })

  test('29 February is clamped rather than producing an invalid date', () => {
    // '2027-02-29' does not exist; Postgres rejects it and the whole
    // "Load defaults" insert would fail on one date.
    assert.deepEqual(rebaseDatesToFy({ feb: '2024-02-29' }, '2026-27'), { feb: '2027-02-28' })
    // A genuine leap year keeps the 29th.
    assert.deepEqual(rebaseDatesToFy({ feb: '2024-02-29' }, '2027-28'), { feb: '2028-02-29' })
  })

  test('an invalid financial year returns the dates untouched', () => {
    // Wrong-but-original beats confidently-corrupted.
    const src = { apr: '2026-04-13' }
    assert.deepEqual(rebaseDatesToFy(src, 'rubbish'), src)
    assert.deepEqual(rebaseDatesToFy(src, '2026-28'), src)
  })

  test('malformed and empty input do not throw', () => {
    assert.deepEqual(rebaseDatesToFy({ apr: 'not-a-date' }, '2026-27'), { apr: 'not-a-date' })
    assert.deepEqual(rebaseDatesToFy({ apr: '2026-13-01' }, '2026-27'), { apr: '2026-13-01' })
    assert.deepEqual(rebaseDatesToFy({}, '2026-27'), {})
    assert.deepEqual(rebaseDatesToFy(null, '2026-27'), {})
    assert.deepEqual(rebaseDatesToFy(undefined, '2026-27'), {})
  })

  test('rebasing is idempotent', () => {
    const once  = rebaseDatesToFy({ oct: '2025-10-31', jan: '2026-01-31' }, '2026-27')
    const twice = rebaseDatesToFy(once, '2026-27')
    assert.deepEqual(twice, once)
  })
})
