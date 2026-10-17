import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyPresumption, buildPresumptionPack, PRESUMPTION_WINDOW_DAYS,
} from '../lib/msme/presumption.ts'
import type { PresumptionInput } from '../lib/msme/presumption.ts'

const TODAY = '2026-11-01'
const v = (o: Partial<PresumptionInput> = {}): PresumptionInput => ({
  vendorName: 'Acme', vendorEmail: 'acme@x.com',
  status: 'emailed', emailBounced: false,
  emailDates: ['2026-10-01T09:00:00Z'], today: TODAY, ...o,
})

/* ── the presumption itself ──────────────────────────────────────────────── */

test('a chased vendor who never replied is presumed non-MSME once the window closes', () => {
  const e = classifyPresumption(v({ emailDates: ['2026-10-01T09:00:00Z'] }))
  assert.equal(e.status, 'presumed')
  assert.equal(e.firstEmailOn, '2026-10-01')
  assert.equal(e.windowClosesOn, '2026-10-16')   // 15 days from the first request
  assert.equal(e.daysRemaining, 0)
})

test('the window runs from the FIRST request, not the latest follow-up', () => {
  // Measuring from the last email would restart the clock on every reminder,
  // so a diligently chased vendor could never become presumable.
  const e = classifyPresumption(v({
    emailDates: ['2026-10-01T09:00:00Z', '2026-10-20T09:00:00Z', '2026-10-28T09:00:00Z'],
  }))
  assert.equal(e.firstEmailOn, '2026-10-01')
  assert.equal(e.lastEmailOn, '2026-10-28')
  assert.equal(e.windowClosesOn, '2026-10-16')
  assert.equal(e.status, 'presumed')
})

test('the window is exactly the 15 days the email promises', () => {
  assert.equal(PRESUMPTION_WINDOW_DAYS, 15)
  // Day 15 — the window closes today, so it has not yet elapsed.
  const onClosing = classifyPresumption(v({ emailDates: ['2026-10-17'], today: '2026-11-01' }))
  assert.equal(onClosing.windowClosesOn, '2026-11-01')
  assert.equal(onClosing.status, 'presumed')   // closes today, so it has run

  const dayBefore = classifyPresumption(v({ emailDates: ['2026-10-18'], today: '2026-11-01' }))
  assert.equal(dayBefore.status, 'window_open')
  assert.equal(dayBefore.daysRemaining, 1)
})

/* ── who the presumption must NOT cover ──────────────────────────────────── */

test('a vendor who was never contacted is never presumed', () => {
  // The dangerous case: a firm that imported 200 vendors and emailed 40 must
  // not get a pack asserting a presumption over the other 160.
  const e = classifyPresumption(v({ status: 'pending', emailDates: [] }))
  assert.equal(e.status, 'never_contacted')
  assert.equal(e.firstEmailOn, null)
  assert.equal(e.windowClosesOn, null)
})

test('a vendor still inside the promised window is held back', () => {
  const e = classifyPresumption(v({ emailDates: ['2026-10-28T09:00:00Z'] }))
  assert.equal(e.status, 'window_open')
  assert.equal(e.windowClosesOn, '2026-11-12')   // 28 Oct + 15 days
  assert.equal(e.daysRemaining, 11)              // from 1 Nov
})

test('a bounced or unsubscribed vendor is not presumed — they never received it', () => {
  // The email's wording turns on "receiving this email", so a bounce needs
  // another channel, not a presumption.
  const e = classifyPresumption(v({ emailBounced: true }))
  assert.equal(e.status, 'undeliverable')
})

test('a vendor who answered is reported as responded, either way they answered', () => {
  for (const s of ['submitted', 'not_msme'] as const) {
    assert.equal(classifyPresumption(v({ status: s })).status, 'responded')
  }
})

test('answering outranks a bounce — a reply proves it was received', () => {
  const e = classifyPresumption(v({ status: 'submitted', emailBounced: true }))
  assert.equal(e.status, 'responded')
})

test('a bounce with no send recorded reads as never contacted, which is accurate', () => {
  const e = classifyPresumption(v({ status: 'pending', emailBounced: true, emailDates: [] }))
  assert.equal(e.status, 'never_contacted')
})

/* ── evidence hygiene ────────────────────────────────────────────────────── */

test('send dates are de-duplicated, normalised to a date and sorted oldest first', () => {
  const e = classifyPresumption(v({
    emailDates: ['2026-10-20T15:00:00Z', '2026-10-01T09:00:00Z', '2026-10-20T18:00:00Z'],
  }))
  assert.deepEqual(e.emailDates, ['2026-10-01', '2026-10-20'])
})

test('unparseable send dates are discarded rather than shown in evidence', () => {
  // A malformed date in a legal document is worse than a missing one.
  const e = classifyPresumption(v({ emailDates: ['', 'not-a-date', '2026-10-01'] }))
  assert.deepEqual(e.emailDates, ['2026-10-01'])
  assert.equal(e.status, 'presumed')
})

test('only bad dates means no send is evidenced, so nothing is presumed', () => {
  const e = classifyPresumption(v({ emailDates: ['rubbish'] }))
  assert.equal(e.status, 'never_contacted')
})

/* ── the assembled pack ──────────────────────────────────────────────────── */

test('every vendor lands in exactly one group, and no group is dropped', () => {
  const pack = buildPresumptionPack([
    v({ vendorName: 'Silent',     emailDates: ['2026-10-01'] }),
    v({ vendorName: 'Recent',     emailDates: ['2026-10-29'] }),
    v({ vendorName: 'Bounced',    emailBounced: true }),
    v({ vendorName: 'Answered',   status: 'submitted' }),
    v({ vendorName: 'Untouched',  status: 'pending', emailDates: [] }),
  ])
  assert.deepEqual(pack.presumed.map(e => e.vendorName),       ['Silent'])
  assert.deepEqual(pack.windowOpen.map(e => e.vendorName),     ['Recent'])
  assert.deepEqual(pack.undeliverable.map(e => e.vendorName),  ['Bounced'])
  assert.deepEqual(pack.responded.map(e => e.vendorName),      ['Answered'])
  assert.deepEqual(pack.neverContacted.map(e => e.vendorName), ['Untouched'])

  const total = pack.presumed.length + pack.windowOpen.length + pack.undeliverable.length
    + pack.responded.length + pack.neverContacted.length
  assert.equal(total, 5)   // nothing vanished
})

test('each group is alphabetical, so two exports of a period are comparable', () => {
  const pack = buildPresumptionPack([
    v({ vendorName: 'Zeta' }), v({ vendorName: 'Alpha' }), v({ vendorName: 'Mid' }),
  ])
  assert.deepEqual(pack.presumed.map(e => e.vendorName), ['Alpha', 'Mid', 'Zeta'])
})

test('an empty vendor list yields an empty pack, not a throw', () => {
  const pack = buildPresumptionPack([])
  assert.deepEqual(pack.presumed, [])
  assert.deepEqual(pack.neverContacted, [])
})
