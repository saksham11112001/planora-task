import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessFreshness, assessBook, UDYAM_FRESH_DAYS } from '../lib/msme/udyamWatch.ts'
import { compareVendor, comparePeriods } from '../lib/msme/periodCompare.ts'
import type { CompareInput, PeriodSide } from '../lib/msme/periodCompare.ts'
import { buildForm1 } from '../lib/msme/form1.ts'
import type { Form1Input } from '../lib/msme/form1.ts'

/* ═══ Udyam re-verification ═══════════════════════════════════════════════ */

const TODAY = '2026-09-30'
const fresh = (o: Record<string, unknown> = {}) => assessFreshness({
  vendorName: 'Acme', category: 'small', udyamRegisteredOn: '2026-06-01', today: TODAY, ...o,
} as Parameters<typeof assessFreshness>[0])

test('a recent certificate is fresh', () => {
  const r = fresh({ udyamRegisteredOn: '2026-06-01' })
  assert.equal(r.status, 'fresh')
  assert.ok(r.ageDays !== null && r.ageDays < UDYAM_FRESH_DAYS)
})

test('a certificate older than a year needs confirming', () => {
  // A year is when reclassification can first have happened, from the returns
  // the enterprise files annually.
  const r = fresh({ udyamRegisteredOn: '2021-07-14' })
  assert.equal(r.status, 'stale')
  assert.equal(r.ageYears, 5.2)
})

test('the threshold boundary is inclusive, so exactly a year is still fresh', () => {
  assert.equal(fresh({ udyamRegisteredOn: '2025-09-30' }).status, 'fresh')   // 365 days
  assert.equal(fresh({ udyamRegisteredOn: '2025-09-29' }).status, 'stale')   // 366
})

test('a micro or small supplier is flagged as affecting 43B(h)', () => {
  // Reclassification to medium would remove the exposure entirely, so these
  // are the ones worth chasing.
  for (const c of ['micro', 'small'] as const) {
    assert.equal(fresh({ category: c, udyamRegisteredOn: '2020-01-01' }).affects43b, true)
  }
})

test('a medium supplier is noted but is a different risk', () => {
  const r = fresh({ category: 'medium', udyamRegisteredOn: '2020-01-01' })
  assert.equal(r.status, 'stale')
  assert.equal(r.affects43b, false)
  assert.match(r.reason, /would begin to apply/)
})

test('an MSME with no registration date is undated, not fresh', () => {
  // Treating a missing date as fresh would quietly give the firm confidence it
  // has not earned.
  for (const d of [null, '', 'not-a-date']) {
    const r = fresh({ udyamRegisteredOn: d })
    assert.equal(r.status, 'undated', `accepted "${d}"`)
    assert.equal(r.ageDays, null)
  }
})

test('a declared non-MSME has no certificate to age', () => {
  const r = fresh({ isNotMsme: true, category: null, udyamRegisteredOn: null })
  assert.equal(r.status, 'not_applicable')
  assert.match(r.reason, /not an MSME/)
})

test('an undeclared vendor is a chase problem, not a re-verification one', () => {
  const r = fresh({ category: null, udyamRegisteredOn: null })
  assert.equal(r.status, 'not_applicable')
  assert.match(r.reason, /not yet declared/)
})

test('a book is summarised oldest-first with the 43B count', () => {
  const s = assessBook([
    { vendorName: 'Old',    category: 'small',  udyamRegisteredOn: '2019-01-01', today: TODAY },
    { vendorName: 'Older',  category: 'micro',  udyamRegisteredOn: '2017-01-01', today: TODAY },
    { vendorName: 'New',    category: 'small',  udyamRegisteredOn: '2026-09-01', today: TODAY },
    { vendorName: 'NoDate', category: 'small',  udyamRegisteredOn: null,         today: TODAY },
    { vendorName: 'Medium', category: 'medium', udyamRegisteredOn: '2015-01-01', today: TODAY },
  ])
  assert.deepEqual(s.stale.map(r => r.vendorName), ['Medium', 'Older', 'Old'])
  assert.deepEqual(s.undated.map(r => r.vendorName), ['NoDate'])
  assert.deepEqual(s.fresh.map(r => r.vendorName), ['New'])
  // Old, Older and NoDate affect 43B; Medium does not.
  assert.equal(s.affecting43bCount, 3)
})

/* ═══ Period comparison ══════════════════════════════════════════════════ */

const side = (o: Partial<PeriodSide> = {}): PeriodSide => ({
  status: 'submitted', isNotMsme: false, category: 'small', outstandingAmount: 10000, ...o,
})
const cmp = (o: Partial<CompareInput> = {}) => compareVendor({
  vendorId: 'v1', vendorName: 'Acme', current: side(), previous: side(), ...o,
})

test('a growing balance is reported with its delta', () => {
  const c = cmp({ previous: side({ outstandingAmount: 10000 }), current: side({ outstandingAmount: 25000 }) })
  assert.ok(c.kinds.includes('balance_up'))
  assert.equal(c.balanceDelta, 15000)
})

test('a reducing balance is reported too', () => {
  const c = cmp({ previous: side({ outstandingAmount: 25000 }), current: side({ outstandingAmount: 10000 }) })
  assert.ok(c.kinds.includes('balance_down'))
  assert.equal(c.balanceDelta, -15000)
})

test('an unstated balance is never treated as zero', () => {
  // A vendor who has not answered yet has not cleared their balance, and
  // reporting a 10,000 reduction would be a fabrication.
  const c = cmp({ previous: side({ outstandingAmount: 10000 }), current: side({ status: 'emailed', outstandingAmount: null }) })
  assert.equal(c.balanceDelta, null)
  assert.ok(!c.kinds.includes('balance_down'))
})

test('becoming an MSME is flagged — it is new 43B(h) exposure', () => {
  const c = cmp({
    previous: side({ status: 'not_msme', isNotMsme: true, category: null, outstandingAmount: null }),
    current:  side({ category: 'micro' }),
  })
  assert.ok(c.kinds.includes('newly_msme'))
})

test('ceasing to be an MSME is flagged', () => {
  const c = cmp({
    previous: side({ category: 'small' }),
    current:  side({ status: 'not_msme', isNotMsme: true, category: null, outstandingAmount: null }),
  })
  assert.ok(c.kinds.includes('newly_not_msme'))
})

test('a category move is flagged — it can change 43B(h) treatment entirely', () => {
  const c = cmp({ previous: side({ category: 'small' }), current: side({ category: 'medium' }) })
  assert.ok(c.kinds.includes('category_changed'))
  assert.equal(c.previousCategory, 'small')
  assert.equal(c.currentCategory, 'medium')
})

test('a vendor who answered last time and has gone quiet is flagged', () => {
  const c = cmp({ previous: side(), current: side({ status: 'emailed', outstandingAmount: null }) })
  assert.ok(c.kinds.includes('newly_silent'))
})

test('a first-time responder is flagged', () => {
  const c = cmp({ previous: side({ status: 'emailed', outstandingAmount: null }), current: side() })
  assert.ok(c.kinds.includes('newly_responded'))
})

test('status changes are claimed only when BOTH sides answered', () => {
  // A vendor mid-chase has not "become" anything. Claiming otherwise would
  // report a status change every cycle before anyone replies.
  const c = cmp({
    previous: side({ status: 'emailed', category: null, outstandingAmount: null }),
    current:  side({ status: 'emailed', category: null, outstandingAmount: null }),
  })
  assert.ok(!c.kinds.includes('newly_msme'))
  assert.ok(!c.kinds.includes('newly_not_msme'))
  assert.ok(!c.kinds.includes('category_changed'))
})

test('no previous declaration reads as a first declaration, not a change', () => {
  for (const prev of [null, side({ status: 'none' })]) {
    const c = cmp({ previous: prev })
    assert.deepEqual(c.kinds, ['first_declaration'])
  }
})

test('a comparison totals both sides and surfaces only the notable', () => {
  const s = comparePeriods([
    { vendorId: '1', vendorName: 'Grew',   previous: side({ outstandingAmount: 100 }), current: side({ outstandingAmount: 300 }) },
    { vendorId: '2', vendorName: 'Silent', previous: side(), current: side({ status: 'emailed', outstandingAmount: null }) },
    { vendorId: '3', vendorName: 'Moved',  previous: side({ category: 'micro' }), current: side({ category: 'small' }) },
  ])
  // Grew 100, Silent 10000, Moved 10000.
  assert.equal(s.totals.previousOutstanding, 20100)
  // Grew 300, Silent unstated (contributes nothing to a sum of stated
  // balances), Moved 10000.
  assert.equal(s.totals.currentOutstanding, 10300)
  assert.equal(s.totals.delta, -9800)
  assert.equal(s.totals.newlySilent, 1)
  assert.equal(s.totals.categoryChanged, 1)
  // A balance simply moving is normal; the other two are not.
  assert.deepEqual(s.notable.map(c => c.vendorName), ['Moved', 'Silent'])
})

/* ═══ Form MSME-1 schedule ═══════════════════════════════════════════════ */

const decl = (o: Partial<Form1Input> = {}): Form1Input => ({
  vendorId: 'v1', vendorName: 'Acme', pan: 'AAAPL1234C', category: 'small', isNotMsme: false,
  status: 'submitted', outstanding: 50000, dueFromDate: '2026-06-01',
  delayReason: 'Pending quality verification', ...o,
})

test('a complete micro or small declaration becomes a filing row', () => {
  const s = buildForm1([decl()])
  assert.equal(s.rows.length, 1)
  assert.equal(s.rows[0].serial, 1)
  assert.equal(s.rows[0].outstanding, 50000)
  assert.deepEqual(s.rows[0].missing, [])
  assert.equal(s.incompleteCount, 0)
})

test('medium enterprises are outside the return, and their absence is visible', () => {
  // MSME-1 covers micro and small only. A medium supplier with a large
  // balance is correctly absent — but silently absent would look like a bug.
  const s = buildForm1([decl({ vendorName: 'Big Co', category: 'medium', outstanding: 900000 })])
  assert.equal(s.rows.length, 0)
  assert.equal(s.excluded[0].reason, 'medium_enterprise')
  assert.equal(s.excluded[0].outstanding, 900000)
})

test('declared non-MSMEs and non-responders are excluded with their reasons', () => {
  const s = buildForm1([
    decl({ vendorName: 'NotMsme', isNotMsme: true, status: 'not_msme' }),
    decl({ vendorName: 'Silent',  status: 'emailed' }),
    decl({ vendorName: 'Never',   status: 'pending' }),
  ])
  assert.equal(s.rows.length, 0)
  assert.deepEqual(s.excluded.map(e => [e.vendorName, e.reason]), [
    ['Never',   'no_declaration'],
    ['NotMsme', 'not_msme'],
    ['Silent',  'no_declaration'],
  ])
})

test('a nil balance is excluded — there is nothing to report', () => {
  for (const amt of [0, null]) {
    const s = buildForm1([decl({ outstanding: amt })])
    assert.equal(s.rows.length, 0)
    assert.equal(s.excluded[0].reason, 'nil_balance')
  }
})

test('an answer with no category is not reportable', () => {
  const s = buildForm1([decl({ category: null })])
  assert.equal(s.rows.length, 0)
  assert.equal(s.excluded[0].reason, 'no_declaration')
})

test('fields the form requires but we lack are named, not left blank', () => {
  // The return cannot be filed as it stands, and the firm needs to know which
  // cell to fill rather than discovering it at the MCA portal.
  const s = buildForm1([decl({ pan: null, dueFromDate: null, delayReason: '  ' })])
  assert.deepEqual(s.rows[0].missing, ['pan', 'dueFromDate', 'delayReason'])
  assert.equal(s.incompleteCount, 1)
})

test('rows are ordered by descending balance and serially numbered', () => {
  const s = buildForm1([
    decl({ vendorName: 'Small',  outstanding: 100 }),
    decl({ vendorName: 'Large',  outstanding: 90000 }),
    decl({ vendorName: 'Medium', outstanding: 5000 }),
  ])
  assert.deepEqual(s.rows.map(r => r.vendorName), ['Large', 'Medium', 'Small'])
  assert.deepEqual(s.rows.map(r => r.serial), [1, 2, 3])
})

test('the total covers only the reportable rows', () => {
  const s = buildForm1([
    decl({ vendorName: 'In',  outstanding: 1000 }),
    decl({ vendorName: 'Out', category: 'medium', outstanding: 999999 }),
  ])
  assert.equal(s.totalOutstanding, 1000)
})

test('an empty period yields an empty schedule rather than throwing', () => {
  const s = buildForm1([])
  assert.deepEqual(s.rows, [])
  assert.equal(s.totalOutstanding, 0)
})
