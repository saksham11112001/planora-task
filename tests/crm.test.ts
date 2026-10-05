import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  round2, priceProposal, weightedPipeline, openPipeline, isLeadStage,
} from '../lib/crm/index.ts'

/* ── round2 ──────────────────────────────────────────────────────────────── */

test('round2 handles the classic floating-point halfway case', () => {
  // Math.round(1.005 * 100) / 100 is 1 in plain JS, because 1.005 is really
  // 1.00499999999999989 in binary.
  assert.equal(round2(1.005), 1.01)
  assert.equal(round2(2.675), 2.68)
})

test('round2 is safe on rubbish input', () => {
  assert.equal(round2(NaN), 0)
  assert.equal(round2(Infinity), 0)
})

/* ── priceProposal ───────────────────────────────────────────────────────── */

test('line amounts are recomputed, never taken from the payload', () => {
  // A client sending amount: 999999 against 1 x 100 must not be believed.
  const r = priceProposal([{ description: 'Audit', qty: 1, rate: 100, amount: 999999 }], 0)
  assert.equal(r.items[0].amount, 100)
  assert.equal(r.subtotal, 100)
  assert.equal(r.total, 100)
})

test('tax is applied and the printed parts add up to the printed total', () => {
  const r = priceProposal([{ description: 'GST filing', qty: 3, rate: 1500 }], 18)
  assert.equal(r.subtotal, 4500)
  assert.equal(r.taxAmount, 810)
  assert.equal(r.total, 5310)
  assert.equal(round2(r.subtotal + r.taxAmount), r.total)
})

test('totals stay consistent with awkward decimals', () => {
  const r = priceProposal([
    { description: 'A', qty: 3,   rate: 33.33 },
    { description: 'B', qty: 1.5, rate: 19.99 },
  ], 18)
  assert.equal(r.items[0].amount, 99.99)
  assert.equal(r.items[1].amount, 29.99)
  assert.equal(r.subtotal, 129.98)
  // The total must equal the sum of the two ROUNDED components, or the
  // document does not add up on screen.
  assert.equal(r.total, round2(r.subtotal + r.taxAmount))
})

test('negative quantities and rates are floored at zero', () => {
  // The line is KEPT because it has a description — a zero-value line is a
  // legitimate thing to show on a quotation. What must not happen is a
  // negative amount silently reducing the total.
  const r = priceProposal([{ description: 'Refund?', qty: -5, rate: -100 }], 0)
  assert.equal(r.items.length, 1)
  assert.equal(r.items[0].qty, 0)
  assert.equal(r.items[0].rate, 0)
  assert.equal(r.items[0].amount, 0)
  assert.equal(r.subtotal, 0)
})

test('an empty line with no description and no value is dropped', () => {
  const r = priceProposal([{ description: '', qty: 0, rate: 0 }], 0)
  assert.equal(r.items.length, 0)
})

test('tax rate is clamped to 0..100', () => {
  assert.equal(priceProposal([{ description: 'x', qty: 1, rate: 100 }], 500).taxRate, 100)
  assert.equal(priceProposal([{ description: 'x', qty: 1, rate: 100 }], -5).taxRate, 0)
  assert.equal(priceProposal([{ description: 'x', qty: 1, rate: 100 }], 'abc').taxRate, 0)
})

test('non-array items do not throw', () => {
  assert.equal(priceProposal(null, 18).subtotal, 0)
  assert.equal(priceProposal('nope', 18).subtotal, 0)
  assert.equal(priceProposal(undefined, 18).total, 0)
})

test('the item list is capped so one request cannot store an unbounded document', () => {
  const many = Array.from({ length: 500 }, (_, i) => ({ description: `line ${i}`, qty: 1, rate: 1 }))
  assert.equal(priceProposal(many, 0).items.length, 100)
})

/* ── pipeline ────────────────────────────────────────────────────────────── */

const leads = [
  { stage: 'new'        as const, value: 1000 },
  { stage: 'qualified'  as const, value: 1000 },
  { stage: 'negotiation'as const, value: 1000 },
  { stage: 'won'        as const, value: 1000 },
  { stage: 'lost'       as const, value: 1000 },
]

test('open pipeline excludes won and lost', () => {
  assert.equal(openPipeline(leads), 3000)
})

test('weighted pipeline applies the stage weights', () => {
  // 0.1 + 0.4 + 0.8 + 1 (won) + 0 (lost) = 2.3 x 1000
  assert.equal(weightedPipeline(leads), 2300)
})

test('a lead with no value contributes nothing rather than NaN', () => {
  assert.equal(openPipeline([{ stage: 'new', value: null }]), 0)
  assert.equal(weightedPipeline([{ stage: 'new', value: null }]), 0)
})

/* ── guards ──────────────────────────────────────────────────────────────── */

test('isLeadStage rejects anything not in the list', () => {
  assert.equal(isLeadStage('qualified'), true)
  assert.equal(isLeadStage('Qualified'), false)
  assert.equal(isLeadStage('deleted'),   false)
  assert.equal(isLeadStage(null),        false)
})
