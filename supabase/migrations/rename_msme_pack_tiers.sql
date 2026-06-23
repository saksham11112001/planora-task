-- Rename MSME pack tiers to match new pricing structure
-- Old → New:
--   pack_20  (20 vendors)  → pack_25  (25 vendors,  ₹2,999/yr)
--   pack_50  (50 vendors)  → pack_100 (100 vendors, ₹7,999/yr)
--   pack_200 (200 vendors) → pack_250 (250 vendors, ₹16,999/yr)
--   pack_250 (250 vendors) → pack_500 (500 vendors, ₹29,999/yr)
--   pack_500 (500 vendors) → pack_enterprise
--
-- Vendor limits are also updated to match the new pack sizes.
-- Run this once in Supabase SQL Editor before deploying the new pricing code.

-- 1. Rename tiers on org_feature_settings (stores current pack_tier per org)
UPDATE org_feature_settings
SET value = CASE value
  WHEN 'pack_20'  THEN 'pack_25'
  WHEN 'pack_50'  THEN 'pack_100'
  WHEN 'pack_200' THEN 'pack_250'
  WHEN 'pack_250' THEN 'pack_500'
  WHEN 'pack_500' THEN 'pack_enterprise'
  ELSE value
END
WHERE feature_key = 'msme_pack_tier'
  AND value IN ('pack_20', 'pack_50', 'pack_200', 'pack_250', 'pack_500');

-- 2. Update vendor_limit to match the new pack sizes on the same table
UPDATE org_feature_settings
SET value = CASE value
  WHEN 'pack_25'         THEN '25'
  WHEN 'pack_100'        THEN '100'
  WHEN 'pack_250'        THEN '250'
  WHEN 'pack_500'        THEN '500'
  WHEN 'pack_enterprise' THEN '9999'
  ELSE value
END
WHERE feature_key = 'msme_vendor_limit'
  AND org_id IN (
    SELECT org_id FROM org_feature_settings
    WHERE feature_key = 'msme_pack_tier'
      AND value IN ('pack_25', 'pack_100', 'pack_250', 'pack_500', 'pack_enterprise')
  );

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

-- Verify: check no old tier names remain
SELECT feature_key, value, COUNT(*) as orgs
FROM org_feature_settings
WHERE feature_key IN ('msme_pack_tier', 'msme_vendor_limit')
GROUP BY feature_key, value
ORDER BY feature_key, value;
