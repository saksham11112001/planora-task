import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideSend, planSends, sendSkipText } from '../lib/msme/sendEligibility.ts'
import type { SendInput } from '../lib/msme/sendEligibility.ts'

const base: SendInput = {
  emailBounced: false,
  periodStatus: 'none',
  periodEmailCount: 0,
  lifetimeEmailCount: 0,
  maxEmails: 5,
  slotsRemaining: 10,
}
const i = (o: Partial<SendInput> = {}): SendInput => ({ ...base, ...o })

/* ── the point of the whole feature ──────────────────────────────────────── */

test('a vendor who submitted in September can still be chased for March', () => {
  // The March declaration does not exist yet, so periodStatus is 'none' even
  // though the vendor has a completed September declaration. If this ever
  // returns send:false the half-yearly feature does not work at all.
  const d = decideSend(i({ periodStatus: 'none', lifetimeEmailCount: 3 }))
  assert.equal(d.send, true)
})

test('a vendor chased to the cap in September starts from zero in March', () => {
  // periodEmailCount restarts; lifetimeEmailCount does not. Applying the cap
  // to the lifetime count would make a chased vendor permanently unreachable.
  const d = decideSend(i({ periodEmailCount: 0, lifetimeEmailCount: 5, maxEmails: 5 }))
  assert.equal(d.send, true)
  assert.equal(d.send && d.attemptNo, 1)   // "email 1 of 5" for the NEW cycle
})

test('a vendor already paid for costs no further slot in a later cycle', () => {
  // Their lifetime count is above zero, so no slot is consumed even with the
  // org completely out of budget.
  const d = decideSend(i({ lifetimeEmailCount: 2, slotsRemaining: 0 }))
  assert.equal(d.send, true)
  assert.equal(d.send && d.consumesSlot, false)
})

/* ── per-period gates ─────────────────────────────────────────────────────── */

test('a vendor who already answered for THIS period is not chased again', () => {
  for (const s of ['submitted', 'not_msme'] as const) {
    const d = decideSend(i({ periodStatus: s }))
    assert.equal(d.send, false)
    assert.equal(!d.send && d.reason, 'already_declared')
  }
})

test('a period in progress is still chaseable', () => {
  for (const s of ['none', 'pending', 'emailed'] as const) {
    assert.equal(decideSend(i({ periodStatus: s })).send, true, `${s} should be sendable`)
  }
})

test('the cap applies to this period and counts the first email', () => {
  // maxEmails is 1 immediate + 4 follow-ups, so attempt 5 is the last allowed.
  assert.equal(decideSend(i({ periodEmailCount: 4, maxEmails: 5 })).send, true)
  const d = decideSend(i({ periodEmailCount: 5, maxEmails: 5 }))
  assert.equal(d.send, false)
  assert.equal(!d.send && d.reason, 'max_emails')
})

test('attempt numbers follow this period, not the vendor lifetime', () => {
  const d = decideSend(i({ periodEmailCount: 2, lifetimeEmailCount: 9 }))
  assert.equal(d.send && d.attemptNo, 3)
})

/* ── opt-out wins over everything ─────────────────────────────────────────── */

test('a bounced or unsubscribed vendor is never emailed', () => {
  // Checked first: every send to a dead address damages sender reputation for
  // ALL of the firm's vendor mail.
  const d = decideSend(i({ emailBounced: true, periodStatus: 'none', slotsRemaining: 99 }))
  assert.equal(d.send, false)
  assert.equal(!d.send && d.reason, 'bounced')
})

/* ── slots ────────────────────────────────────────────────────────────────── */

test('a never-emailed vendor consumes a slot', () => {
  const d = decideSend(i({ lifetimeEmailCount: 0 }))
  assert.equal(d.send && d.consumesSlot, true)
})

test('a never-emailed vendor is blocked when no slots remain', () => {
  const d = decideSend(i({ lifetimeEmailCount: 0, slotsRemaining: 0 }))
  assert.equal(d.send, false)
  assert.equal(!d.send && d.reason, 'slot_limit')
})

test('an ineligible vendor is not charged a slot', () => {
  // The slot check is last precisely so this reports the real reason rather
  // than blaming the budget.
  const d = decideSend(i({ periodStatus: 'submitted', slotsRemaining: 0 }))
  assert.equal(!d.send && d.reason, 'already_declared')
})

/* ── batch planning ───────────────────────────────────────────────────────── */

type V = { id: string } & Partial<SendInput>
const read = (v: V) => ({
  emailBounced:       v.emailBounced ?? false,
  periodStatus:       v.periodStatus ?? 'none' as const,
  periodEmailCount:   v.periodEmailCount ?? 0,
  lifetimeEmailCount: v.lifetimeEmailCount ?? 0,
  maxEmails:          v.maxEmails ?? 5,
})

test('the slot budget is drawn down in order and then blocks', () => {
  const plan = planSends<V>(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }], read, 2)
  assert.deepEqual(plan.map(p => p.decision.send), [true, true, false])
  assert.equal(!plan[2].decision.send && plan[2].decision.reason, 'slot_limit')
})

test('returning vendors do not eat the budget meant for new ones', () => {
  // The bug this replaces: bulk-shoot pre-sliced the never-emailed vendors by
  // the budget and dropped the remainder with no reason recorded. Here a
  // returning vendor sandwiched between new ones costs nothing.
  const plan = planSends<V>(
    [{ id: 'new1' }, { id: 'returning', lifetimeEmailCount: 4 }, { id: 'new2' }], read, 2)
  assert.deepEqual(plan.map(p => p.decision.send), [true, true, true])
  assert.deepEqual(plan.map(p => p.decision.send && p.decision.consumesSlot),
                   [true, false, true])
})

test('every vendor in a batch gets a decision, so none vanishes silently', () => {
  const plan = planSends<V>([
    { id: 'ok' },
    { id: 'bounced', emailBounced: true },
    { id: 'done', periodStatus: 'submitted' },
    { id: 'capped', periodEmailCount: 5 },
  ], read, 10)
  assert.equal(plan.length, 4)
  assert.deepEqual(plan.map(p => p.decision.send ? 'send' : p.decision.reason),
                   ['send', 'bounced', 'already_declared', 'max_emails'])
})

test('a zero or negative budget still produces decisions', () => {
  const plan = planSends<V>([{ id: 'a' }], read, -5)
  assert.equal(!plan[0].decision.send && plan[0].decision.reason, 'slot_limit')
})

test('an empty batch plans nothing', () => {
  assert.deepEqual(planSends<V>([], read, 5), [])
})

/* ── messages ─────────────────────────────────────────────────────────────── */

test('skip messages name the period, so a firm is not told to upgrade wrongly', () => {
  assert.match(sendSkipText('already_declared', 5), /for this period/)
  assert.match(sendSkipText('max_emails', 5), /Maximum 5 emails.*for this period/)
  assert.match(sendSkipText('slot_limit', 5), /Upgrade your pack/)
  assert.match(sendSkipText('bounced', 5), /unsubscribed|bounced/)
})
