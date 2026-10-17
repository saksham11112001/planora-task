import { test } from 'node:test'
import assert from 'node:assert/strict'
import { carryForward, mirrorPatch, periodLabel, MIRRORED_FIELDS } from '../lib/msme/declarations.ts'
import type { Declaration } from '../lib/msme/declarations.ts'

const decl = (o: Partial<Declaration>): Partial<Declaration> => ({
  period_end: '2026-09-30', status: 'submitted', ...o,
})

/* ── carry-forward ────────────────────────────────────────────────────────── */

test('registration details are carried into the next half-year', () => {
  const out = carryForward(decl({
    udyam_number: 'UDYAM-MH-01-0000001',
    pan: 'AAAPL1234C',
    msme_category: 'small',
    nature_of_business: 'manufacturer',
    udyam_registered_on: '2021-07-14',
    cert_url: 'r2:msme/cert.pdf',
  }))
  assert.equal(out.udyam_number, 'UDYAM-MH-01-0000001')
  assert.equal(out.pan, 'AAAPL1234C')
  assert.equal(out.msme_category, 'small')
  assert.equal(out.nature_of_business, 'manufacturer')
  assert.equal(out.udyam_registered_on, '2021-07-14')
  assert.equal(out.cert_url, 'r2:msme/cert.pdf')
})

test('the outstanding balance is NEVER carried forward', () => {
  // The one figure the return turns on. Carrying it would let a vendor
  // confirm a six-month-old balance without ever looking at it.
  const out = carryForward(decl({ outstanding_amount: 50000, udyam_number: 'U' }))
  assert.ok(!('outstanding_amount' in out))
  assert.equal(out.udyam_number, 'U')   // but the rest still comes across
})

test('the payment proof is not carried forward either', () => {
  // It evidences a specific period's balance, so re-using it would attach
  // last half-year's document to this half-year's figure.
  const out = carryForward(decl({ proof_url: 'r2:msme/proof.pdf' }))
  assert.ok(!('proof_url' in out))
})

test('per-submission facts are not carried forward', () => {
  // Fresh consent and a fresh timestamp are required each half-year (DPDP).
  const out = carryForward(decl({
    submitted_at: '2026-10-10T00:00:00Z',
    declared_at:  '2026-10-10T00:00:00Z',
    consent_at:   '2026-10-10T00:00:00Z',
    status:       'submitted',
    email_count:  3,
  }))
  for (const f of ['submitted_at', 'declared_at', 'consent_at', 'status', 'email_count']) {
    assert.ok(!(f in out), `${f} must not be carried forward`)
  }
})

test('a non-MSME declaration carries its flag so the vendor is not re-asked blindly', () => {
  const out = carryForward(decl({ is_not_msme: true, status: 'not_msme' }))
  assert.equal(out.is_not_msme, true)
})

test('nothing to carry forward yields an empty patch, not nulls', () => {
  // A first-cycle vendor must not have every field explicitly nulled, which
  // would overwrite column defaults.
  assert.deepEqual(carryForward(null), {})
  assert.deepEqual(carryForward(undefined), {})
  assert.deepEqual(carryForward({}), {})
})

test('null fields are skipped rather than carried as null', () => {
  const out = carryForward(decl({ udyam_number: null, pan: null, msme_category: 'micro' }))
  assert.ok(!('udyam_number' in out))
  assert.ok(!('pan' in out))
  assert.equal(out.msme_category, 'micro')
})

/* ── the vendor-row mirror ────────────────────────────────────────────────── */

test('the mirror takes the latest declaration by period end', () => {
  const patch = mirrorPatch([
    decl({ period_end: '2026-03-31', outstanding_amount: 100 }),
    decl({ period_end: '2026-09-30', outstanding_amount: 999 }),
    decl({ period_end: '2025-09-30', outstanding_amount: 1 }),
  ])
  assert.equal(patch!.outstanding_amount, 999)
})

test('the mirror never touches the slot ledger', () => {
  // email_count and last_emailed_at on msme_vendors are lifetime billing
  // state. A per-period value overwriting them would hand slots back and
  // defeat the anti-gaming scheme.
  assert.ok(!MIRRORED_FIELDS.includes('email_count' as never))
  assert.ok(!MIRRORED_FIELDS.includes('last_emailed_at' as never))

  const patch = mirrorPatch([decl({ email_count: 3, last_emailed_at: '2026-10-01T00:00:00Z' })])
  assert.ok(!('email_count' in patch!))
  assert.ok(!('last_emailed_at' in patch!))
})

test('the mirror carries status and the declared figures', () => {
  const patch = mirrorPatch([decl({
    status: 'submitted', outstanding_amount: 42, udyam_number: 'U-1',
    cert_url: 'r2:msme/c.pdf', submitted_at: '2026-10-10T00:00:00Z',
  })])
  assert.equal(patch!.status, 'submitted')
  assert.equal(patch!.outstanding_amount, 42)
  assert.equal(patch!.udyam_number, 'U-1')
  // cert_url is what the certificate download route reads off the vendor row.
  assert.equal(patch!.cert_url, 'r2:msme/c.pdf')
  assert.equal(patch!.submitted_at, '2026-10-10T00:00:00Z')
})

test('no declarations means no mirror patch at all', () => {
  // Returning {} would issue a pointless UPDATE; null tells the caller to skip.
  assert.equal(mirrorPatch([]), null)
})

test('the mirror explicitly writes nulls, so cleared fields are cleared', () => {
  // A new cycle's declaration has no balance yet. The mirror must blank the
  // vendor row's figure rather than leaving last period's showing.
  const patch = mirrorPatch([decl({ period_end: '2027-03-31', status: 'emailed', outstanding_amount: null })])
  assert.ok('outstanding_amount' in patch!)
  assert.equal(patch!.outstanding_amount, null)
})

/* ── labels ───────────────────────────────────────────────────────────────── */

test('a period label names the half-year a vendor is being asked about', () => {
  assert.equal(periodLabel('2026-09-30'), 'Apr–Sep 2026 (as on 30 Sep 2026)')
  assert.equal(periodLabel('2027-03-31'), 'Oct 2026–Mar 2027 (as on 31 Mar 2027)')
})

test('a bad stored period degrades to the raw value instead of throwing', () => {
  // This runs inside email sends; a throw here would block a vendor chase.
  assert.equal(periodLabel('2026-06-30'), '2026-06-30')
  assert.equal(periodLabel(null), '')
  assert.equal(periodLabel(undefined), '')
})
