import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normaliseName, normaliseGstin, matchLedger, SKIP_REASON_TEXT,
} from '../lib/msme/ledgerImport.ts'
import type { LedgerRow, VendorRef } from '../lib/msme/ledgerImport.ts'

const VENDORS: VendorRef[] = [
  { id: 'v-acme',  vendorName: 'Acme Steel Co Pvt Ltd', gstin: '27AAAPL1234C1ZV' },
  { id: 'v-bolt',  vendorName: 'Bolt & Nut Industries' },
  { id: 'v-plain', vendorName: 'Plain Traders' },
]
const row = (o: Partial<LedgerRow> = {}): LedgerRow => ({
  rowNo: 1, partyName: 'Acme Steel Co Pvt Ltd',
  invoiceNo: 'INV-1', invoiceDate: '2026-06-01', amount: 50000, ...o,
})

/* ── name normalisation ──────────────────────────────────────────────────── */

test('company forms and punctuation are stripped to the identifying core', () => {
  // All of these are one supplier in a ledger written by hand over years.
  for (const n of [
    'Acme Steel Co Pvt Ltd', 'ACME STEEL', 'Acme  Steel.',
    'Acme Steel Co. (P) Ltd.', 'Acme Steel Private Limited', 'Acme Steel & Co',
  ]) {
    assert.equal(normaliseName(n), 'acme steel', `failed for "${n}"`)
  }
})

test('stacked company forms are all removed', () => {
  assert.equal(normaliseName('Foo Industries Pvt Ltd'), 'foo')
  assert.equal(normaliseName('Foo Co Pvt Ltd'), 'foo')
})

test('a name that is nothing BUT a company form is never emptied', () => {
  // Reducing "Limited" to "" would make it match every other empty name.
  assert.equal(normaliseName('Limited'), 'limited')
  assert.equal(normaliseName('Co'), 'co')
})

test('distinct suppliers stay distinct', () => {
  assert.notEqual(normaliseName('Acme Steel'), normaliseName('Acme Cement'))
})

test('normalisation survives empty and junk input', () => {
  assert.equal(normaliseName(''), '')
  assert.equal(normaliseName('   '), '')
  assert.equal(normaliseName('...'), '')
})

test('GSTIN comparison ignores case and spacing', () => {
  assert.equal(normaliseGstin(' 27aaapl1234c1zv '), '27AAAPL1234C1ZV')
  assert.equal(normaliseGstin(null), '')
  assert.equal(normaliseGstin(undefined), '')
})

/* ── matching ────────────────────────────────────────────────────────────── */

test('GSTIN matches even when the ledger name differs completely', () => {
  // The whole point of trying GSTIN first: it is a legal identifier.
  const r = matchLedger([row({ partyName: 'A S C P L - MUMBAI BRANCH', gstin: '27AAAPL1234C1ZV' })], VENDORS)
  assert.equal(r.matched.length, 1)
  assert.equal(r.matched[0].vendorId, 'v-acme')
  assert.equal(r.matched[0].matchedBy, 'gstin')
})

test('a differently written name matches on the normalised form', () => {
  const r = matchLedger([row({ partyName: 'ACME STEEL', gstin: null })], VENDORS)
  assert.equal(r.matched[0].vendorId, 'v-acme')
  assert.equal(r.matched[0].matchedBy, 'name')
})

test('an unmatched party is reported, never silently dropped', () => {
  // A dropped row is a balance missing from a statutory return.
  const r = matchLedger([row({ partyName: 'Someone Else', gstin: null })], VENDORS)
  assert.equal(r.matched.length, 0)
  assert.equal(r.skipped[0].reason, 'no_match')
  assert.equal(r.skipped[0].partyName, 'Someone Else')
})

test('an ambiguous name is refused, with the candidates named', () => {
  // Two tracked vendors reduce to "shared": picking one would attach a
  // statutory declaration to the wrong supplier.
  const ambiguous: VendorRef[] = [
    { id: 'a', vendorName: 'Shared Pvt Ltd' },
    { id: 'b', vendorName: 'Shared Limited' },
  ]
  const r = matchLedger([row({ partyName: 'Shared', gstin: null })], ambiguous)
  assert.equal(r.matched.length, 0)
  assert.equal(r.skipped[0].reason, 'ambiguous_name')
  assert.deepEqual(r.skipped[0].candidates, ['Shared Pvt Ltd', 'Shared Limited'])
})

test('GSTIN wins over an ambiguous name', () => {
  const ambiguous: VendorRef[] = [
    { id: 'a', vendorName: 'Shared Pvt Ltd', gstin: '27AAAPL1234C1ZV' },
    { id: 'b', vendorName: 'Shared Limited' },
  ]
  const r = matchLedger([row({ partyName: 'Shared', gstin: '27AAAPL1234C1ZV' })], ambiguous)
  assert.equal(r.matched[0].vendorId, 'a')
  assert.equal(r.matched[0].matchedBy, 'gstin')
})

test('a row with neither name nor GSTIN is skipped', () => {
  const r = matchLedger([row({ partyName: '', gstin: null })], VENDORS)
  assert.equal(r.skipped[0].reason, 'no_party_name')
})

test('no near-miss guessing: a close-but-different name does not match', () => {
  // Edit-distance matching would turn a confident "please check" into a
  // plausible wrong answer, and the cost here is a misfiled return.
  const r = matchLedger([row({ partyName: 'Acme Steal', gstin: null })], VENDORS)
  assert.equal(r.skipped[0].reason, 'no_match')
})

/* ── row validation ─────────────────────────────────────────────────────── */

test('a missing or impossible date is rejected rather than coerced', () => {
  for (const d of ['', '01/06/2026', '2026-6-1', '2026-02-31', 'rubbish']) {
    const r = matchLedger([row({ invoiceDate: d })], VENDORS)
    assert.equal(r.skipped[0]?.reason, 'invalid_date', `accepted "${d}"`)
  }
})

test('a real leap day is accepted', () => {
  assert.equal(matchLedger([row({ invoiceDate: '2028-02-29' })], VENDORS).matched.length, 1)
})

test('an impossible payment date is rejected too', () => {
  const r = matchLedger([row({ paymentDate: '2026-13-01' })], VENDORS)
  assert.equal(r.skipped[0].reason, 'invalid_date')
})

test('an absent payment date is fine — it means unpaid', () => {
  const r = matchLedger([row({ paymentDate: null })], VENDORS)
  assert.equal(r.matched[0].paymentDate, null)
})

test('a missing or negative amount is rejected', () => {
  for (const a of [null, undefined, -1, NaN] as unknown as number[]) {
    const r = matchLedger([row({ amount: a })], VENDORS)
    assert.equal(r.skipped[0]?.reason, 'invalid_amount', `accepted ${a}`)
  }
})

test('a paid amount above the invoice is clamped, not carried through', () => {
  // A ledger showing more settled than billed is a data error; carrying it
  // would produce a negative outstanding balance.
  const r = matchLedger([row({ amount: 1000, paidAmount: 5000 })], VENDORS)
  assert.equal(r.matched[0].paidAmount, 1000)
})

test('a negative paid amount is floored at zero', () => {
  const r = matchLedger([row({ amount: 1000, paidAmount: -50 })], VENDORS)
  assert.equal(r.matched[0].paidAmount, 0)
})

test('agreement days are carried, and nonsense becomes null', () => {
  assert.equal(matchLedger([row({ agreementDays: 30 })], VENDORS).matched[0].agreementDays, 30)
  assert.equal(matchLedger([row({ agreementDays: null })], VENDORS).matched[0].agreementDays, null)
  assert.equal(matchLedger([row({ agreementDays: -5 })], VENDORS).matched[0].agreementDays, null)
})

test('a blank invoice number becomes null rather than an empty string', () => {
  // The de-duplication index is partial on invoice_no, so "" would be a
  // meaningless key that blocks a second un-numbered row.
  assert.equal(matchLedger([row({ invoiceNo: '  ' })], VENDORS).matched[0].invoiceNo, null)
})

/* ── completeness ───────────────────────────────────────────────────────── */

test('every row lands in exactly one list', () => {
  const rows = [
    row({ rowNo: 1 }),
    row({ rowNo: 2, partyName: 'Nobody', gstin: null }),
    row({ rowNo: 3, invoiceDate: 'bad' }),
    row({ rowNo: 4, partyName: 'Bolt & Nut Industries', gstin: null }),
  ]
  const r = matchLedger(rows, VENDORS)
  assert.equal(r.matched.length + r.skipped.length, 4)
  assert.deepEqual(r.matched.map(m => m.rowNo).sort(), [1, 4])
  assert.deepEqual(r.skipped.map(s => s.rowNo).sort(), [2, 3])
})

test('an empty ledger yields empty lists', () => {
  assert.deepEqual(matchLedger([], VENDORS), { matched: [], skipped: [] })
})

test('every skip reason has readable text for the report', () => {
  for (const k of Object.keys(SKIP_REASON_TEXT)) {
    assert.ok(SKIP_REASON_TEXT[k as keyof typeof SKIP_REASON_TEXT].length > 10)
  }
})
