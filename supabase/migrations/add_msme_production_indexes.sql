-- Production indexes and constraints for MSME module
-- Apply before launch: Supabase Dashboard → SQL Editor

-- 1. Unique constraint: prevent duplicate active vendor emails per org
--    (app-level race condition guard — this is the DB-level enforcement)
CREATE UNIQUE INDEX IF NOT EXISTS msme_vendors_org_email_active_uq
  ON msme_vendors (org_id, vendor_email)
  WHERE is_deleted = false;

-- 2. Index on token_hash (most frequent public query — every form load + submit)
CREATE INDEX IF NOT EXISTS msme_tokens_token_hash_idx
  ON msme_tokens (token_hash);

-- 3. Index for email slot counting (fires on every shoot-email request)
CREATE INDEX IF NOT EXISTS msme_vendors_org_email_count_idx
  ON msme_vendors (org_id, email_count)
  WHERE is_deleted = false;

-- 4. Partial index for the daily reminder cron (avoids full table scan)
CREATE INDEX IF NOT EXISTS msme_vendors_status_emailed_idx
  ON msme_vendors (org_id, email_count, last_emailed_at)
  WHERE status = 'emailed' AND is_deleted = false;

-- 5. Index for org_feature_settings (fires 4–6 times per request on shoot-email)
CREATE INDEX IF NOT EXISTS org_feature_settings_org_feature_idx
  ON org_feature_settings (org_id, feature_key);

-- 6. Index for payment idempotency lookup
CREATE INDEX IF NOT EXISTS msme_pack_payments_payment_id_status_idx
  ON msme_pack_payments (gateway_payment_id, status)
  WHERE gateway_payment_id IS NOT NULL;

-- 7. Index on org_id for msme_vendors (used in nearly every query)
CREATE INDEX IF NOT EXISTS msme_vendors_org_id_idx
  ON msme_vendors (org_id);

-- 8. Index for token vendor/org lookup (used in reminder function)
CREATE INDEX IF NOT EXISTS msme_tokens_vendor_org_idx
  ON msme_tokens (vendor_id, org_id);

-- 9. Index for msme_tokens expiry cleanup (if a cleanup job is added later)
CREATE INDEX IF NOT EXISTS msme_tokens_expires_at_idx
  ON msme_tokens (expires_at)
  WHERE used_at IS NULL;
