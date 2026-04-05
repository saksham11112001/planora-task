-- =========================================================
-- COUPONS + REDEMPTIONS FINAL CLEAN MIGRATION
-- Safe for legacy Supabase/Postgres schemas
-- =========================================================

-- Needed for gen_random_uuid() on many Supabase setups
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) CREATE BASE TABLES IF NOT EXISTS
-- =========================================================

CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- =========================================================
-- 2) UPGRADE coupons TABLE TO LATEST SHAPE
--    This is the important part for old databases
-- =========================================================

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER,
  ADD COLUMN IF NOT EXISTS discount_inr INTEGER,
  ADD COLUMN IF NOT EXISTS plan_tier TEXT,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS max_uses INTEGER,
  ADD COLUMN IF NOT EXISTS uses_count INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- Fill defaults for old rows
UPDATE coupons SET discount_type = 'free_plan' WHERE discount_type IS NULL;
UPDATE coupons SET duration_months = 1          WHERE duration_months IS NULL;
UPDATE coupons SET uses_count = 0               WHERE uses_count IS NULL;
UPDATE coupons SET is_active = true             WHERE is_active IS NULL;

-- Ensure correct nullability/defaults
ALTER TABLE coupons
  ALTER COLUMN discount_type SET DEFAULT 'free_plan',
  ALTER COLUMN duration_months SET DEFAULT 1,
  ALTER COLUMN uses_count SET DEFAULT 0,
  ALTER COLUMN is_active SET DEFAULT true;

-- discount_type must exist
ALTER TABLE coupons
  ALTER COLUMN discount_type SET NOT NULL;

-- These MUST be nullable because percent/fixed coupons can apply to any plan
ALTER TABLE coupons
  ALTER COLUMN plan_tier DROP NOT NULL;

ALTER TABLE coupons
  ALTER COLUMN discount_percent DROP NOT NULL;

ALTER TABLE coupons
  ALTER COLUMN discount_inr DROP NOT NULL;

ALTER TABLE coupons
  ALTER COLUMN max_uses DROP NOT NULL;

ALTER TABLE coupons
  ALTER COLUMN expires_at DROP NOT NULL;

-- =========================================================
-- 3) DROP LEGACY / UNKNOWN CONSTRAINTS IF PRESENT
-- =========================================================

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_type_check;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_percent_check;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_inr_check;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_plan_tier_check;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_coupon_logic_check;

-- =========================================================
-- 4) ADD CLEAN CONSTRAINTS
-- =========================================================

-- Allowed coupon types
ALTER TABLE coupons
  ADD CONSTRAINT coupons_discount_type_check
  CHECK (discount_type IN ('free_plan','percent','fixed_inr'));

-- Percent must be valid if present
ALTER TABLE coupons
  ADD CONSTRAINT coupons_discount_percent_check
  CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 100);

-- INR fixed amount must be positive if present
ALTER TABLE coupons
  ADD CONSTRAINT coupons_discount_inr_check
  CHECK (discount_inr IS NULL OR discount_inr > 0);

-- Plan tier may be NULL for generic discounts
ALTER TABLE coupons
  ADD CONSTRAINT coupons_plan_tier_check
  CHECK (plan_tier IS NULL OR plan_tier IN ('starter','pro','business'));

-- Usage count sanity
ALTER TABLE coupons
  ADD CONSTRAINT coupons_uses_count_check
  CHECK (uses_count >= 0);

-- Duration sanity
ALTER TABLE coupons
  ADD CONSTRAINT coupons_duration_months_check
  CHECK (duration_months >= 1);

-- Max uses sanity
ALTER TABLE coupons
  ADD CONSTRAINT coupons_max_uses_check
  CHECK (max_uses IS NULL OR max_uses > 0);

-- Core business logic:
-- free_plan  => requires plan_tier, no discount_percent, no discount_inr
-- percent    => requires discount_percent, no discount_inr
-- fixed_inr  => requires discount_inr, no discount_percent
ALTER TABLE coupons
  ADD CONSTRAINT coupons_coupon_logic_check
  CHECK (
    (
      discount_type = 'free_plan'
      AND plan_tier IS NOT NULL
      AND discount_percent IS NULL
      AND discount_inr IS NULL
    )
    OR
    (
      discount_type = 'percent'
      AND discount_percent IS NOT NULL
      AND discount_inr IS NULL
    )
    OR
    (
      discount_type = 'fixed_inr'
      AND discount_inr IS NOT NULL
      AND discount_percent IS NULL
    )
  );

-- =========================================================
-- 5) ENABLE RLS
-- =========================================================

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Remove old policies if rerun
DROP POLICY IF EXISTS "service_all_coupons" ON coupons;
DROP POLICY IF EXISTS "auth_read_active_coupons" ON coupons;
DROP POLICY IF EXISTS "service_all_redemptions" ON coupon_redemptions;

-- Service role full control
CREATE POLICY "service_all_coupons"
ON coupons
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users can read active coupons only
CREATE POLICY "auth_read_active_coupons"
ON coupons
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "service_all_redemptions"
ON coupon_redemptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =========================================================
-- 6) SEED DATA
-- =========================================================

INSERT INTO coupons (
  code,
  description,
  discount_type,
  plan_tier,
  duration_months,
  max_uses,
  discount_percent,
  discount_inr,
  expires_at
) VALUES
-- Full free-plan access coupons
('SGNG2025FREE', 'SNG internal — 1 year Pro access',           'free_plan', 'pro',      12, NULL, NULL, NULL, NULL),
('BETAUSER',     'Beta users — 6 months Starter free',         'free_plan', 'starter',  6,  100,  NULL, NULL, '2026-12-31 23:59:59+00'),
('PARTNER50',    'Partner programme — 3 months Pro free',      'free_plan', 'pro',      3,  50,   NULL, NULL, NULL),
('EARLYBIRD',    'Early bird — 3 months Pro free',             'free_plan', 'pro',      3,  200,  NULL, NULL, '2026-06-30 23:59:59+00'),
('CA2025',       'CA firms promo — 6 months Pro free',         'free_plan', 'pro',      6,  500,  NULL, NULL, '2026-12-31 23:59:59+00'),
('LAUNCH100',    'Launch promo — 1 month Business free',       'free_plan', 'business', 1,  100,  NULL, NULL, NULL),
('FREEPRO3',     '3 months Pro — gifted access',               'free_plan', 'pro',      3,  NULL, NULL, NULL, NULL),
('STARTER6FREE', '6 months Starter — special offer',           'free_plan', 'starter',  6,  NULL, NULL, NULL, NULL),

-- Percentage discount coupons
('HALF50',       '50% off first payment',                      'percent',   NULL,       1,  1000, 50,   NULL, NULL),
('SAVE30',       '30% off any plan',                           'percent',   NULL,       1,  500,  30,   NULL, NULL),
('ANNUAL20',     '20% off — annual billing incentive',         'percent',   NULL,       12, NULL, 20,   NULL, NULL),
('WELCOME10',    '10% off welcome discount',                   'percent',   NULL,       1,  NULL, 10,   NULL, NULL),
('FLASH40',      '40% flash sale discount',                    'percent',   NULL,       1,  200,  40,   NULL, '2026-06-30 23:59:59+00'),
('CA50OFF',      '50% off for CA firms',                       'percent',   NULL,       1,  300,  50,   NULL, '2026-12-31 23:59:59+00'),

-- Fixed INR examples
('FLAT999',      'Flat ₹999 off first payment',                'fixed_inr', NULL,       1,  100,  NULL, 999,  NULL),
('BUSI1500',     'Flat ₹1500 off business plan payment',       'fixed_inr', 'business', 1,  50,   NULL, 1500, NULL)

ON CONFLICT (code) DO NOTHING;