-- Rename MSME pack tiers to match new pricing structure.
-- Pack tier + vendor_limit live inside the config JSONB column on org_feature_settings.
--
-- Old → New:
--   pack_20  (20 vendors)  → pack_25  (25 vendors,  ₹2,999/yr)
--   pack_50  (50 vendors)  → pack_100 (100 vendors, ₹7,999/yr)
--   pack_200 (200 vendors) → pack_250 (250 vendors, ₹16,999/yr)
--   pack_250 (250 vendors) → pack_500 (500 vendors, ₹29,999/yr)
--   pack_500 (500 vendors) → pack_enterprise
--
-- Run once in Supabase SQL Editor before deploying the new pricing code.

-- 1. Rename tier string inside config JSONB
UPDATE org_feature_settings
SET config = jsonb_set(
  config,
  '{tier}',
  CASE config->>'tier'
    WHEN 'pack_20'  THEN '"pack_25"'
    WHEN 'pack_50'  THEN '"pack_100"'
    WHEN 'pack_200' THEN '"pack_250"'
    WHEN 'pack_250' THEN '"pack_500"'
    WHEN 'pack_500' THEN '"pack_enterprise"'
    ELSE config->'tier'
  END::jsonb
)
WHERE feature_key = 'msme_pack'
  AND config->>'tier' IN ('pack_20', 'pack_50', 'pack_200', 'pack_250', 'pack_500');

-- 2. Update vendor_limit inside config JSONB to match new pack sizes
UPDATE org_feature_settings
SET config = jsonb_set(
  config,
  '{vendor_limit}',
  CASE config->>'tier'
    WHEN 'pack_25'         THEN '25'
    WHEN 'pack_100'        THEN '100'
    WHEN 'pack_250'        THEN '250'
    WHEN 'pack_500'        THEN '500'
    WHEN 'pack_enterprise' THEN '9999'
    ELSE config->'vendor_limit'
  END::jsonb
)
WHERE feature_key = 'msme_pack'
  AND config->>'tier' IN ('pack_25', 'pack_100', 'pack_250', 'pack_500', 'pack_enterprise');

-- 3. Rename tiers on msme_pack_payments (historical payment records)
UPDATE msme_pack_payments
SET pack_tier = CASE pack_tier
  WHEN 'pack_20'  THEN 'pack_25'
  WHEN 'pack_50'  THEN 'pack_100'
  WHEN 'pack_200' THEN 'pack_250'
  WHEN 'pack_250' THEN 'pack_500'
  WHEN 'pack_500' THEN 'pack_enterprise'
  ELSE pack_tier
END
WHERE pack_tier IN ('pack_20', 'pack_50', 'pack_200', 'pack_250', 'pack_500');

-- Verify: check current pack configs after migration
SELECT org_id, config->>'tier' as tier, config->>'vendor_limit' as vendor_limit
FROM org_feature_settings
WHERE feature_key = 'msme_pack'
ORDER BY config->>'tier';
