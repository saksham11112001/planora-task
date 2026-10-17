import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidPeriodEnd, describePeriod, periodsForFinancialYear,
  currentPeriod, previousPeriod, nextPeriod, CARRY_FORWARD_FIELDS,
} from '../lib/msme/periods.ts'

/* ── what counts as a period ──────────────────────────────────────────────── */

test('only 31 March and 30 September are MSME period ends', () => {
  assert.ok(isValidPeriodEnd('2026-03-31'))
  assert.ok(isValidPeriodEnd('2026-09-30'))

  assert.ok(!isValidPeriodEnd('2026-03-30'))   // off by a day
  assert.ok(!isValidPeriodEnd('2026-09-31'))   // not a real date
  assert.ok(!isValidPeriodEnd('2026-06-30'))   // quarter end, not a half-year
  assert.ok(!isValidPeriodEnd('2026-12-31'))   // calendar year end
  assert.ok(!isValidPeriodEnd(''))
  assert.ok(!isValidPeriodEnd(null))
  assert.ok(!isValidPeriodEnd(undefined))
  assert.ok(!isValidPeriodEnd(20260331))
})

test('an invalid period end throws rather than being guessed at', () => {
  // Guessing would file a declaration against the wrong half-year, which is
  // the kind of error nobody notices until an audit.
  assert.throws(() => describePeriod('2026-06-30'), /Not an MSME period end/)
  assert.throws(() => describePeriod('rubbish'), /Not an MSME period end/)
})

/* ── the statutory calendar ───────────────────────────────────────────────── */

test('30 September closes the Apr–Sep half, and the return is due 31 October', () => {
  const p = describePeriod('2026-09-30')
  assert.equal(p.half, 'H1')
  assert.equal(p.periodStart, '2026-04-01')
  assert.equal(p.dueDate, '2026-10-31')
  assert.equal(p.financialYear, '2026-27')
})

test('31 March closes the Oct–Mar half, and the return is due 30 April', () => {
  const p = describePeriod('2027-03-31')
  assert.equal(p.half, 'H2')
  // The half-year began the PREVIOUS October, not in the year named by the date.
  assert.equal(p.periodStart, '2026-10-01')
  assert.equal(p.dueDate, '2027-04-30')
  assert.equal(p.financialYear, '2026-27')
})

test('both halves of a financial year report the same financial year', () => {
  // The whole point: 30 Sep 2026 and 31 Mar 2027 are the two cycles of FY2026-27.
  assert.equal(describePeriod('2026-09-30').financialYear,
               describePeriod('2027-03-31').financialYear)
})

test('labels name the half-year a vendor is being asked about', () => {
  assert.equal(describePeriod('2026-09-30').label, 'Apr–Sep 2026 (as on 30 Sep 2026)')
  assert.equal(describePeriod('2027-03-31').label, 'Oct 2026–Mar 2027 (as on 31 Mar 2027)')
  assert.equal(describePeriod('2026-09-30').shortLabel, 'H1 FY2026-27')
  assert.equal(describePeriod('2027-03-31').shortLabel, 'H2 FY2026-27')
})

test('the as-on date is available on its own, for emails and forms', () => {
  // The vendor email used to hardcode "as on 31st March", which was wrong for
  // one of the two cycles every single year.
  assert.equal(describePeriod('2026-09-30').asOn, '30 Sep 2026')
  assert.equal(describePeriod('2027-03-31').asOn, '31 Mar 2027')
  assert.equal(describePeriod('2026-09-30').rangeLabel, 'Apr–Sep 2026')
  assert.equal(describePeriod('2027-03-31').rangeLabel, 'Oct 2026–Mar 2027')
})

/* ── a year's two cycles ──────────────────────────────────────────────────── */

test('a financial year yields its two cycles, earliest first', () => {
  const ps = periodsForFinancialYear('2026-27')
  assert.equal(ps.length, 2)
  assert.equal(ps[0].periodEnd, '2026-09-30')
  assert.equal(ps[1].periodEnd, '2027-03-31')
})

test('a malformed financial year yields nothing instead of throwing', () => {
  // Comes from a query string, so it must degrade rather than 500.
  assert.deepEqual(periodsForFinancialYear('2026-28'), [])   // halves do not follow on
  assert.deepEqual(periodsForFinancialYear('2026'), [])
  assert.deepEqual(periodsForFinancialYear('FY26-27'), [])
  assert.deepEqual(periodsForFinancialYear(''), [])
})

test('a financial year spanning a century still resolves', () => {
  const ps = periodsForFinancialYear('2099-00')
  assert.equal(ps[0].periodEnd, '2099-09-30')
  assert.equal(ps[1].periodEnd, '2100-03-31')
  assert.equal(ps[1].financialYear, '2099-00')
})

/* ── which period a firm is collecting for ────────────────────────────────── */

test('the current period is the most recent half-year that has closed', () => {
  // A declaration states figures "as on <period end>". An unclosed period
  // would open the form on a question no vendor can answer.
  assert.equal(currentPeriod('2026-10-17').periodEnd, '2026-09-30')  // chasing Oct 31 filing
  assert.equal(currentPeriod('2026-11-15').periodEnd, '2026-09-30')
  assert.equal(currentPeriod('2026-12-31').periodEnd, '2026-09-30')
  assert.equal(currentPeriod('2026-05-01').periodEnd, '2026-03-31')
  assert.equal(currentPeriod('2026-04-15').periodEnd, '2026-03-31')
})

test('in January to March the last closed half-year is the previous September', () => {
  assert.equal(currentPeriod('2027-01-05').periodEnd, '2026-09-30')
  assert.equal(currentPeriod('2027-03-30').periodEnd, '2026-09-30')
})

test('the period flips on the day it closes, not the day after', () => {
  // On 31 March the balances being stated are 31 March balances.
  assert.equal(currentPeriod('2027-03-31').periodEnd, '2027-03-31')
  assert.equal(currentPeriod('2027-04-01').periodEnd, '2027-03-31')
  assert.equal(currentPeriod('2026-09-30').periodEnd, '2026-09-30')
  assert.equal(currentPeriod('2026-09-29').periodEnd, '2026-03-31')
})

/* ── stepping between periods ─────────────────────────────────────────────── */

test('stepping back crosses the year boundary correctly', () => {
  assert.equal(previousPeriod('2027-03-31').periodEnd, '2026-09-30')
  assert.equal(previousPeriod('2026-09-30').periodEnd, '2026-03-31')
})

test('stepping forward crosses the year boundary correctly', () => {
  assert.equal(nextPeriod('2026-09-30').periodEnd, '2027-03-31')
  assert.equal(nextPeriod('2027-03-31').periodEnd, '2027-09-30')
})

test('stepping forward then back returns to the same period', () => {
  for (const end of ['2026-03-31', '2026-09-30', '2027-03-31', '2027-09-30']) {
    assert.equal(previousPeriod(nextPeriod(end).periodEnd).periodEnd, end)
    assert.equal(nextPeriod(previousPeriod(end).periodEnd).periodEnd, end)
  }
})

test('the previous period is always the one before it in time', () => {
  for (const end of ['2026-03-31', '2026-09-30', '2027-03-31']) {
    assert.ok(previousPeriod(end).periodEnd < end)
    assert.ok(nextPeriod(end).periodEnd > end)
  }
})

/* ── carry-forward ────────────────────────────────────────────────────────── */

test('the outstanding amount is never carried forward', () => {
  // Carrying a stale balance would let a vendor confirm a figure that is no
  // longer true without ever looking at it — the one field that MUST be
  // re-stated each half-year.
  assert.ok(!CARRY_FORWARD_FIELDS.includes('outstanding_amount' as never))
  assert.ok(!CARRY_FORWARD_FIELDS.includes('proof_url' as never))
})

test('identity and registration details are carried forward', () => {
  // These do not change between half-years, and re-keying them is what kills
  // response rates on the second cycle.
  for (const f of ['udyam_number', 'pan', 'msme_category', 'nature_of_business',
                   'udyam_registered_on', 'is_not_msme', 'cert_url']) {
    assert.ok(CARRY_FORWARD_FIELDS.includes(f as never), `${f} should be carried forward`)
  }
})
