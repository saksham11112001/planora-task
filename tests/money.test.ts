/**
 * Partner tiers, commission maths, and MSME pack pricing.
 * These decide what customers are charged and what partners are paid, so the
 * tests assert INVARIANTS (rates, ordering, GST, rounding) rather than just
 * echoing the current constants back.
 *
 * Run: npm test
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PARTNER_TIERS, tierForSignups, msmeCommissionPaise } from '../lib/partner/tiers.ts'
import { MSME_PACKS, MSME_ADDON_PACKS, FREE_VENDOR_LIMIT, getPackByTier } from '../lib/msme/packs.ts'

const GST_MULTIPLIER = 1.18   // checkout charges price + 18% GST

describe('partner tiers — table integrity', () => {
  test('thresholds ascend and start at zero', () => {
    assert.equal(PARTNER_TIERS[0].minSignups, 0, 'first tier must cover zero signups')
    for (let i = 1; i < PARTNER_TIERS.length; i++) {
      assert.ok(
        PARTNER_TIERS[i].minSignups > PARTNER_TIERS[i - 1].minSignups,
        `tier ${PARTNER_TIERS[i].key} threshold must exceed ${PARTNER_TIERS[i - 1].key}`,
      )
    }
  })

  test('rates never decrease as tiers rise', () => {
    for (let i = 1; i < PARTNER_TIERS.length; i++) {
      assert.ok(
        PARTNER_TIERS[i].ratePct >= PARTNER_TIERS[i - 1].ratePct,
        `levelling up must never cut the rate (${PARTNER_TIERS[i - 1].key} → ${PARTNER_TIERS[i].key})`,
      )
    }
  })

  test('rates are sane percentages', () => {
    for (const t of PARTNER_TIERS) {
      assert.ok(t.ratePct > 0 && t.ratePct <= 50, `${t.key} rate ${t.ratePct}% is out of range`)
    }
  })

  test('keys are unique', () => {
    assert.equal(new Set(PARTNER_TIERS.map(t => t.key)).size, PARTNER_TIERS.length)
  })
})

describe('tierForSignups', () => {
  test('maps signup counts to the documented ladder (1 / 5 / 10)', () => {
    assert.equal(tierForSignups(0).key,  'starter')
    assert.equal(tierForSignups(1).key,  'bronze')
    assert.equal(tierForSignups(4).key,  'bronze')
    assert.equal(tierForSignups(5).key,  'silver')
    assert.equal(tierForSignups(9).key,  'silver')
    assert.equal(tierForSignups(10).key, 'gold')
    assert.equal(tierForSignups(999).key, 'gold')
  })

  test('is monotonic — more signups never demotes a partner', () => {
    let prevRate = 0
    for (let n = 0; n <= 60; n++) {
      const rate = tierForSignups(n).ratePct
      assert.ok(rate >= prevRate, `rate dropped at ${n} signups (${prevRate}% → ${rate}%)`)
      prevRate = rate
    }
  })

  test('never returns undefined, including for odd input', () => {
    for (const n of [0, -1, 0.5, Number.MAX_SAFE_INTEGER]) {
      assert.ok(tierForSignups(n)?.key, `no tier returned for ${n}`)
    }
  })
})

describe('msmeCommissionPaise', () => {
  test('computes the tier percentage of the pack price', () => {
    assert.equal(msmeCommissionPaise(100000, 10), 10000)   // ₹1,000 @10% = ₹100
    assert.equal(msmeCommissionPaise(299900, 5),  14995)   // ₹2,999 @5%
    assert.equal(msmeCommissionPaise(1699900, 20), 339980) // ₹16,999 @20%
  })

  test('returns whole paise — never a fraction of a paisa', () => {
    for (const amount of [1, 7, 33, 999, 100001, 299900, 1699900]) {
      for (const rate of PARTNER_TIERS.map(t => t.ratePct)) {
        const c = msmeCommissionPaise(amount, rate)
        assert.ok(Number.isInteger(c), `${amount}@${rate}% produced non-integer paise: ${c}`)
      }
    }
  })

  test('zero-value edges pay nothing', () => {
    assert.equal(msmeCommissionPaise(0, 20), 0)   // 100%-coupon grant stores 0
    assert.equal(msmeCommissionPaise(100000, 0), 0)
  })

  test('commission never exceeds the pack price', () => {
    for (const pack of MSME_PACKS) {
      for (const t of PARTNER_TIERS) {
        const c = msmeCommissionPaise(pack.price_paise, t.ratePct)
        assert.ok(c <= pack.price_paise, `${pack.tier}@${t.key} pays out more than the pack costs`)
        assert.ok(c >= 0, `${pack.tier}@${t.key} produced a negative commission`)
      }
    }
  })

  test('scales linearly with the amount', () => {
    assert.equal(msmeCommissionPaise(200000, 10), msmeCommissionPaise(100000, 10) * 2)
  })
})

describe('MSME packs — table integrity', () => {
  test('tiers are unique', () => {
    assert.equal(new Set(MSME_PACKS.map(p => p.tier)).size, MSME_PACKS.length)
  })

  test('the free pack is free and matches FREE_VENDOR_LIMIT', () => {
    const free = MSME_PACKS.find(p => p.tier === 'free')
    assert.ok(free, 'a free pack must exist')
    assert.equal(free.price_paise, 0)
    assert.equal(free.vendor_limit, FREE_VENDOR_LIMIT,
      'the free pack limit and FREE_VENDOR_LIMIT must agree — they are used interchangeably as the fallback')
  })

  test('paid packs cost more and carry more vendors as the tier rises', () => {
    const paid = MSME_PACKS.filter(p => p.price_paise > 0)
    for (let i = 1; i < paid.length; i++) {
      assert.ok(paid[i].vendor_limit > paid[i - 1].vendor_limit,
        `${paid[i].tier} must carry more vendors than ${paid[i - 1].tier}`)
      assert.ok(paid[i].price_paise > paid[i - 1].price_paise,
        `${paid[i].tier} must cost more than ${paid[i - 1].tier}`)
    }
  })

  test('per-vendor rate improves with bigger packs (the stated value proposition)', () => {
    const paid = MSME_PACKS.filter(p => p.price_paise > 0)
    for (let i = 1; i < paid.length; i++) {
      const prev = paid[i - 1].price_paise / paid[i - 1].vendor_limit
      const curr = paid[i].price_paise / paid[i].vendor_limit
      assert.ok(curr < prev, `${paid[i].tier} must be cheaper per vendor than ${paid[i - 1].tier}`)
    }
  })

  test('the advertised per-vendor label matches the actual price', () => {
    // Catches a pricing typo where the label and the charged amount diverge.
    for (const p of MSME_PACKS) {
      const claimed = Number(p.per_vendor.replace(/[^\d.]/g, ''))
      if (!claimed) continue                       // 'Free' / '—' have no figure
      const actual = p.price_paise / 100 / p.vendor_limit
      assert.ok(Math.abs(actual - claimed) < 1,
        `${p.tier} claims ${p.per_vendor} but works out at ₹${actual.toFixed(2)}/vendor`)
    }
  })

  test('prices are stored ex-GST in whole paise', () => {
    for (const p of MSME_PACKS) {
      assert.ok(Number.isInteger(p.price_paise), `${p.tier} price is not whole paise`)
      assert.ok(p.price_paise % 100 === 0, `${p.tier} price is not a whole rupee`)
    }
  })

  test('at most one pack is flagged recommended', () => {
    assert.ok(MSME_PACKS.filter(p => p.recommended).length <= 1)
  })
})

describe('getPackByTier', () => {
  test('resolves every known tier', () => {
    for (const p of MSME_PACKS) assert.equal(getPackByTier(p.tier).tier, p.tier)
  })

  test('falls back to the free pack for anything unknown', () => {
    // Fail-safe: an unrecognised tier must never grant a larger vendor limit.
    assert.equal(getPackByTier('does_not_exist').tier, 'free')
    assert.equal(getPackByTier('').tier, 'free')
    assert.equal(getPackByTier('does_not_exist').vendor_limit, FREE_VENDOR_LIMIT)
  })
})

describe('add-on packs', () => {
  test('slot counts are unique and positive', () => {
    assert.equal(new Set(MSME_ADDON_PACKS.map(a => a.slots)).size, MSME_ADDON_PACKS.length)
    for (const a of MSME_ADDON_PACKS) assert.ok(a.slots > 0 && a.price_paise > 0)
  })

  test('add-on pricing matches the equivalent pack tier', () => {
    // Add-ons are documented as mapping to the same pricing tiers; a drift here
    // means buying slots piecemeal silently costs more or less than the pack.
    for (const a of MSME_ADDON_PACKS) {
      const pack = MSME_PACKS.find(p => p.vendor_limit === a.slots)
      if (!pack) continue
      assert.equal(a.price_paise, pack.price_paise,
        `add-on of ${a.slots} slots (${a.price_paise}) disagrees with pack ${pack.tier} (${pack.price_paise})`)
    }
  })
})

describe('GST + coupon checkout maths', () => {
  // Mirrors the expression in app/api/msme/pay/route.ts:
  //   chargeablePaise = round(base * 1.18 * (1 - discountPct/100))
  const chargeable = (base: number, discountPct = 0) =>
    Math.round(base * GST_MULTIPLIER * (1 - discountPct / 100))

  test('adds 18% GST when there is no coupon', () => {
    assert.equal(chargeable(299900), 353882)     // ₹2,999 → ₹3,538.82
    assert.equal(chargeable(1699900), 2005882)   // ₹16,999 → ₹20,058.82
  })

  test('a 100% coupon reduces the charge to zero', () => {
    for (const p of MSME_PACKS) assert.equal(chargeable(p.price_paise, 100), 0)
  })

  test('discounts apply after GST and stay within bounds', () => {
    for (const p of MSME_PACKS.filter(p => p.price_paise > 0)) {
      const full = chargeable(p.price_paise)
      for (const pct of [0, 10, 25, 50, 99, 100]) {
        const c = chargeable(p.price_paise, pct)
        assert.ok(Number.isInteger(c), `${p.tier}@${pct}% produced non-integer paise`)
        assert.ok(c >= 0, `${p.tier}@${pct}% produced a negative charge`)
        assert.ok(c <= full, `${p.tier}@${pct}% charged more than the undiscounted price`)
      }
    }
  })

  test('the charged amount always exceeds the ex-GST base (no coupon)', () => {
    // Regression guard for the bug where the stored amount was the ex-GST list
    // price while the customer was charged the GST-inclusive figure.
    for (const p of MSME_PACKS.filter(p => p.price_paise > 0)) {
      assert.ok(chargeable(p.price_paise) > p.price_paise,
        `${p.tier}: GST-inclusive charge must exceed the ex-GST base`)
    }
  })
})
