import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allowedDaysFor, msmedInterest, assessVendor, assessExposure,
  outstandingAsOn, dueFromDate,
  DEFAULT_PAYMENT_DAYS, MAX_AGREED_PAYMENT_DAYS, MSMED_INTEREST_MULTIPLE,
} from '../lib/msme/section43b.ts'
import type { VendorInput, InvoiceInput } from '../lib/msme/section43b.ts'

const RATE = 6.5          // RBI bank rate, so section 16 runs at 19.5%
const ASON = '2026-09-30'

const inv = (o: Partial<InvoiceInput> = {}): InvoiceInput => ({
  invoiceDate: '2026-04-01', amount: 100000, ...o,
})
const vendor = (o: Partial<VendorInput> = {}): VendorInput => ({
  vendorId: 'v1', vendorName: 'Acme', category: 'small',
  nature: 'manufacturer', invoices: [inv()], ...o,
})

/* ── section 15 time limits ──────────────────────────────────────────────── */

test('no written agreement means 15 days', () => {
  assert.equal(DEFAULT_PAYMENT_DAYS, 15)
  assert.equal(allowedDaysFor(null), 15)
  assert.equal(allowedDaysFor(undefined), 15)
})

test('a written agreement is honoured up to the statutory 45 days', () => {
  assert.equal(allowedDaysFor(30), 30)
  assert.equal(allowedDaysFor(45), 45)
})

test('an agreement cannot extend the limit beyond 45 days', () => {
  // A 90-day contract does not buy 90 days: section 15 caps it, so storing 90
  // verbatim would compute a disallowance that is simply wrong.
  assert.equal(MAX_AGREED_PAYMENT_DAYS, 45)
  assert.equal(allowedDaysFor(90), 45)
  assert.equal(allowedDaysFor(365), 45)
})

test('a nonsensical agreement falls back to 15, not to the kindest reading', () => {
  assert.equal(allowedDaysFor(-10), 15)
  assert.equal(allowedDaysFor(NaN), 15)
})

/* ── who 43B(h) covers ───────────────────────────────────────────────────── */

test('a medium enterprise produces no disallowance — it is outside the section', () => {
  const e = assessVendor(vendor({ category: 'medium' }), ASON, RATE)
  assert.equal(e.totalDisallowed, 0)
  assert.equal(e.totalInterest, 0)
  assert.equal(e.invoices[0].exemptReason, 'medium_enterprise')
})

test('a declared non-MSME produces no disallowance', () => {
  const e = assessVendor(vendor({ isNotMsme: true, category: null }), ASON, RATE)
  assert.equal(e.totalDisallowed, 0)
  assert.equal(e.invoices[0].exemptReason, 'not_msme')
})

test('an unknown status is flagged, never assumed either way', () => {
  // Assuming "not MSME" would hide real exposure; assuming "small" would
  // invent some. It has to be reported as unassessable.
  const e = assessVendor(vendor({ category: null }), ASON, RATE)
  assert.equal(e.invoices[0].exemptReason, 'unknown_status')
  assert.equal(e.totalDisallowed, 0)
})

test('micro and small are both inside the section', () => {
  for (const c of ['micro', 'small'] as const) {
    const e = assessVendor(vendor({ category: c }), ASON, RATE)
    assert.equal(e.invoices[0].breached, true, `${c} should be assessed`)
    assert.ok(e.totalDisallowed > 0)
  }
})

/* ── the breach test ────────────────────────────────────────────────────── */

test('an invoice paid inside the window breaches nothing', () => {
  const e = assessVendor(vendor({
    invoices: [inv({ invoiceDate: '2026-04-01', paymentDate: '2026-04-10', paidAmount: 100000 })],
  }), ASON, RATE)
  assert.equal(e.invoices[0].breached, false)
  assert.equal(e.invoices[0].daysLate, 0)
  assert.equal(e.invoices[0].exemptReason, 'within_time_limit')
  assert.equal(e.totalDisallowed, 0)
})

test('the due date is the invoice date plus the allowed days', () => {
  const e = assessVendor(vendor({ invoices: [inv({ invoiceDate: '2026-04-01' })] }), ASON, RATE)
  assert.equal(e.invoices[0].dueBy, '2026-04-16')        // 1 Apr + 15
  const agreed = assessVendor(vendor({
    invoices: [inv({ invoiceDate: '2026-04-01', agreementDays: 45 })],
  }), ASON, RATE)
  assert.equal(agreed.invoices[0].dueBy, '2026-05-16')   // 1 Apr + 45
})

test('payment on the due date itself is not late', () => {
  const e = assessVendor(vendor({
    invoices: [inv({ invoiceDate: '2026-04-01', paymentDate: '2026-04-16', paidAmount: 100000 })],
  }), ASON, RATE)
  assert.equal(e.invoices[0].daysLate, 0)
  assert.equal(e.invoices[0].breached, false)
})

test('one day past the due date is a breach', () => {
  const e = assessVendor(vendor({
    invoices: [inv({ invoiceDate: '2026-04-01', paymentDate: '2026-04-17', paidAmount: 100000 })],
  }), ASON, RATE)
  assert.equal(e.invoices[0].daysLate, 1)
  assert.equal(e.invoices[0].breached, true)
})

test('an unpaid invoice is measured to the assessment date, not frozen', () => {
  // A growing liability must not look static.
  const early = assessVendor(vendor({ invoices: [inv({ invoiceDate: '2026-04-01' })] }), '2026-06-30', RATE)
  const later = assessVendor(vendor({ invoices: [inv({ invoiceDate: '2026-04-01' })] }), '2026-09-30', RATE)
  assert.ok(later.invoices[0].daysLate > early.invoices[0].daysLate)
  assert.ok(later.totalInterest > early.totalInterest)
})

/* ── what gets disallowed ───────────────────────────────────────────────── */

test('the disallowance attaches to what is still payable', () => {
  // 43B(h) defers the deduction for a sum PAYABLE beyond the limit. Once it is
  // settled it is no longer payable, so a late-but-paid invoice carries
  // interest but no disallowance.
  const unpaid = assessVendor(vendor({ invoices: [inv({ amount: 50000 })] }), ASON, RATE)
  assert.equal(unpaid.totalDisallowed, 50000)

  const paidLate = assessVendor(vendor({
    invoices: [inv({ amount: 50000, paidAmount: 50000, paymentDate: '2026-08-01' })],
  }), ASON, RATE)
  assert.equal(paidLate.totalDisallowed, 0)
  assert.ok(paidLate.totalInterest > 0, 'section 16 interest still accrued')
})

test('a part payment leaves only the remainder exposed', () => {
  const e = assessVendor(vendor({
    invoices: [inv({ amount: 100000, paidAmount: 40000 })],
  }), ASON, RATE)
  assert.equal(e.invoices[0].outstanding, 60000)
  assert.equal(e.totalDisallowed, 60000)
})

test('a part-paid invoice with no full-settlement date stays outstanding', () => {
  // payment_date means "settled in full"; a part payment must not stop the clock.
  const e = assessVendor(vendor({
    invoices: [inv({ amount: 100000, paidAmount: 99999, paymentDate: null })],
  }), ASON, RATE)
  assert.equal(e.invoices[0].breached, true)
  assert.equal(e.invoices[0].outstanding, 1)
})

test('an invoice dated after the assessment date is not yet outstanding', () => {
  // It does not exist as at the assessment date, so it must not inflate the
  // outstanding total — and assessVendor must agree with outstandingAsOn on
  // the identical ledger.
  const invoices = [
    inv({ invoiceDate: '2026-05-01', amount: 50000 }),
    inv({ invoiceDate: '2026-11-01', amount: 90000 }),   // after asOn
  ]
  const e = assessVendor(vendor({ invoices }), ASON, RATE)
  assert.equal(e.totalOutstanding, 50000)
  assert.equal(e.totalOutstanding, outstandingAsOn(invoices, ASON))
  assert.equal(e.invoices[1].breached, false)
  assert.equal(e.invoices[1].disallowed, 0)
})

/* ── section 16 interest ────────────────────────────────────────────────── */

test('interest is three times the bank rate', () => {
  assert.equal(MSMED_INTEREST_MULTIPLE, 3)
  // One year at 3 x 6.5% = 19.5%, compounded monthly, is ~21.34% effective.
  const i = msmedInterest(100000, 365, 6.5)
  assert.ok(i > 21000 && i < 21500, `expected ~21.3k, got ${i}`)
})

test('interest compounds monthly, not annually', () => {
  // Simple interest on 1 lakh for a year at 19.5% is 19,500. Monthly
  // compounding must exceed that, or the section is being applied wrongly.
  assert.ok(msmedInterest(100000, 365, 6.5) > 19500)
})

test('interest grows with the delay and with the rate', () => {
  assert.ok(msmedInterest(100000, 180, 6.5) < msmedInterest(100000, 365, 6.5))
  assert.ok(msmedInterest(100000, 365, 6.0) < msmedInterest(100000, 365, 6.5))
})

test('no delay, no principal or no rate means no interest', () => {
  assert.equal(msmedInterest(100000, 0, 6.5), 0)
  assert.equal(msmedInterest(0, 365, 6.5), 0)
  assert.equal(msmedInterest(100000, 365, 0), 0)
  assert.equal(msmedInterest(100000, -5, 6.5), 0)
})

/* ── the book-level summary ─────────────────────────────────────────────── */

test('traders are totalled separately, not folded in and not dropped', () => {
  // Whether 43B(h) reaches traders is a position, not settled law, so the firm
  // has to be able to see both numbers and choose.
  const s = assessExposure([
    vendor({ vendorId: 'm', nature: 'manufacturer', invoices: [inv({ amount: 10000 })] }),
    vendor({ vendorId: 't', nature: 'trader',       invoices: [inv({ amount: 70000 })] }),
  ], ASON, RATE)
  assert.equal(s.disallowed, 10000)
  assert.equal(s.traderExposure.disallowed, 70000)
  assert.equal(s.traderExposure.vendorCount, 1)
  assert.equal(s.vendorCount, 1)
})

test('unknown-status vendors are quantified as unassessed risk', () => {
  // The cheapest way to shrink unquantified exposure is to chase these, so the
  // number has to be visible rather than absent.
  const s = assessExposure([
    vendor({ vendorId: 'u', category: null, invoices: [inv({ amount: 25000 })] }),
  ], ASON, RATE)
  assert.equal(s.disallowed, 0)
  assert.equal(s.unknownStatus.outstanding, 25000)
  assert.equal(s.unknownStatus.vendorCount, 1)
})

test('a medium supplier is in neither total', () => {
  const s = assessExposure([
    vendor({ vendorId: 'x', category: 'medium', invoices: [inv({ amount: 90000 })] }),
  ], ASON, RATE)
  assert.equal(s.disallowed, 0)
  assert.equal(s.vendorCount, 0)
  assert.equal(s.unknownStatus.vendorCount, 0)
  assert.equal(s.traderExposure.vendorCount, 0)
})

test('an empty book summarises to zero rather than throwing', () => {
  const s = assessExposure([], ASON, RATE)
  assert.equal(s.disallowed, 0)
  assert.deepEqual(s.vendors, [])
})

test('money is rounded to paise, so totals do not drift', () => {
  const s = assessExposure([
    vendor({ invoices: [inv({ amount: 0.015 }), inv({ amount: 0.015 })] }),
  ], ASON, RATE)
  assert.equal(s.disallowed, Math.round(s.disallowed * 100) / 100)
})

/* ── derived balances: what replaces asking the vendor ──────────────────── */

test('outstanding as on a date counts invoices unsettled at that date', () => {
  const invoices = [
    inv({ invoiceDate: '2026-04-01', amount: 10000, paymentDate: '2026-05-01', paidAmount: 10000 }),
    inv({ invoiceDate: '2026-06-01', amount: 20000 }),
    inv({ invoiceDate: '2026-12-01', amount: 40000 }),   // after the date
  ]
  // At 30 Sep: the April one is settled, the June one is open, December is not
  // yet raised.
  assert.equal(outstandingAsOn(invoices, '2026-09-30'), 20000)
})

test('an invoice settled AFTER the date still counts as on the date', () => {
  // This is the trap in deriving a historic balance: today's ledger shows it
  // paid, but it was outstanding on 30 September and the return says so.
  const invoices = [inv({ invoiceDate: '2026-06-01', amount: 20000, paymentDate: '2026-10-15', paidAmount: 20000 })]
  assert.equal(outstandingAsOn(invoices, '2026-09-30'), 20000)
  assert.equal(outstandingAsOn(invoices, '2026-10-31'), 0)
})

test('a part-paid invoice contributes only its unpaid remainder', () => {
  const invoices = [inv({ invoiceDate: '2026-06-01', amount: 20000, paidAmount: 5000 })]
  assert.equal(outstandingAsOn(invoices, '2026-09-30'), 15000)
})

test('a later full settlement does not shrink a past balance', () => {
  // paidAmount is a running total with no date of its own, so it must not be
  // netted off once the dated settlement is known to fall after the as-on
  // date. Otherwise re-running a filed period's figures months later silently
  // reports a smaller balance than was filed.
  const invoices = [inv({
    invoiceDate: '2026-06-01', amount: 20000, paidAmount: 20000, paymentDate: '2026-11-01',
  })]
  assert.equal(outstandingAsOn(invoices, '2026-09-30'), 20000)
  assert.equal(dueFromDate(invoices, '2026-09-30'), '2026-06-01')
  // And zero once the settlement date has passed.
  assert.equal(outstandingAsOn(invoices, '2026-11-30'), 0)
})

test('the due-from date is the oldest still-unsettled invoice', () => {
  // Exactly what Form MSME-1 asks for per supplier.
  const invoices = [
    inv({ invoiceDate: '2026-04-01', amount: 10000, paymentDate: '2026-05-01', paidAmount: 10000 }),
    inv({ invoiceDate: '2026-06-01', amount: 20000 }),
    inv({ invoiceDate: '2026-07-01', amount: 30000 }),
  ]
  assert.equal(dueFromDate(invoices, '2026-09-30'), '2026-06-01')
})

test('a fully settled book has no due-from date', () => {
  const invoices = [inv({ invoiceDate: '2026-04-01', amount: 10000, paymentDate: '2026-05-01', paidAmount: 10000 })]
  assert.equal(dueFromDate(invoices, '2026-09-30'), null)
  assert.equal(outstandingAsOn(invoices, '2026-09-30'), 0)
})
