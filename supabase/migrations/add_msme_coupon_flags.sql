-- Allow new MSME pack tier names in the coupons.plan_tier constraint
-- and add a one-time-use flag for MSME coupons

-- Drop old constraint that only allowed starter/pro/business
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_plan_tier_check;

-- Add new constraint that also allows MSME pack tiers
ALTER TABLE coupons
  ADD CONSTRAINT coupons_plan_tier_check
  CHECK (plan_tier IS NULL OR plan_tier IN (
    'starter', 'pro', 'business',
    'pack_25', 'pack_100', 'pack_250', 'pack_500', 'pack_enterprise'
  ));

-- Add one_time_use flag (when true, each org can only redeem once)
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS one_time_use BOOLEAN NOT NULL DEFAULT true;

-- Add msme_only flag to scope coupons to MSME module only
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS msme_only BOOLEAN NOT NULL DEFAULT false;
