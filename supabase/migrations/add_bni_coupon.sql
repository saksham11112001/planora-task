-- ============================================================================
-- BNI — one free year of the lowest paid MSME pack, once per organisation.
--
-- HOW IT WORKS
--   Modelled as a 100% percent-discount coupon scoped to a single pack tier.
--   POST /api/msme/pay already short-circuits Razorpay when the resolved
--   discount reaches 100% and activates the pack directly, so nothing new is
--   needed in the payment flow — the coupon just has to be shaped correctly.
--
--   discount_type    'percent' — the pay route only resolves percent coupons.
--                    Do NOT use 'free_plan'; that type is never read there and
--                    the coupon would silently do nothing.
--   discount_percent 100       — triggers the free-grant path.
--   plan_tier        'pack_25' — Starter, the cheapest paid pack (25 vendors,
--                    ₹2,999/yr). The pay route now REFUSES to apply a coupon
--                    whose plan_tier does not match the pack being bought, so
--                    this cannot be turned on the ₹29,999 Business pack.
--   duration_months  12        — the granted term. The pay route stamps
--                    expires_at = now + duration_months on the pack config.
--   one_time_use     true      — enforced through coupon_redemptions, which is
--                    UNIQUE (coupon_id, org_id). See the note below.
--   max_uses         NULL      — no cap on how many different orgs may redeem.
--                    Set a number here if BNI should be limited to a cohort.
--   expires_at       NULL      — the CODE never stops working. This is separate
--                    from the 12-month access each redeemer receives.
--
-- "ONE USER, ONCE" — WHAT IS ACTUALLY ENFORCED
--   coupon_redemptions is keyed by ORGANISATION, not by user, so the guarantee
--   is one redemption per org. In the MSME product each signup creates its own
--   org, so in practice this is one per user. It is not a defence against the
--   same person creating a second organisation — that would need a redemption
--   keyed on the phone-number identity anchor used by the referral system.
--   Worth knowing before this goes to a room full of BNI members.
--
-- SAFE TO RE-RUN: ON CONFLICT (code) DO UPDATE keeps the definition correct
-- without ever resetting uses_count or deleting redemptions.
-- ============================================================================

INSERT INTO coupons (
  code, description,
  discount_type, discount_percent, discount_inr,
  plan_tier, duration_months,
  max_uses, uses_count, expires_at, is_active
) VALUES (
  'BNI',
  'BNI members — 1 year free on the Starter pack (25 vendors)',
  'percent', 100, NULL,
  'pack_25', 12,
  NULL, 0, NULL, true
)
ON CONFLICT (code) DO UPDATE SET
  description      = EXCLUDED.description,
  discount_type    = EXCLUDED.discount_type,
  discount_percent = EXCLUDED.discount_percent,
  plan_tier        = EXCLUDED.plan_tier,
  duration_months  = EXCLUDED.duration_months,
  is_active        = EXCLUDED.is_active;

-- one_time_use and msme_only were added by add_msme_coupon_flags.sql and both
-- default sensibly, but set them explicitly so the coupon does not depend on
-- the order these files were applied in.
UPDATE coupons SET one_time_use = true, msme_only = true WHERE code = 'BNI';

-- VERIFY
--   SELECT code, discount_type, discount_percent, plan_tier, duration_months,
--          one_time_use, msme_only, max_uses, uses_count, is_active
--   FROM coupons WHERE code = 'BNI';
--
-- Expect: percent / 100 / pack_25 / 12 / true / true / NULL / 0 / true
--
-- Who has redeemed it:
--   SELECT o.name, r.redeemed_at
--   FROM coupon_redemptions r
--   JOIN coupons c ON c.id = r.coupon_id
--   JOIN organisations o ON o.id = r.org_id
--   WHERE c.code = 'BNI' ORDER BY r.redeemed_at DESC;
