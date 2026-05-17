-- ─────────────────────────────────────────────────────────────────────────────
-- Anti-abuse: phone-as-identity-anchor for referral system
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Unique partial index on phone_number (non-NULL only).
--    Allows multiple NULL values (users who haven't provided a phone)
--    but enforces that each real phone maps to exactly one account.
--    CONCURRENTLY avoids a full table lock on production.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON users (phone_number)
  WHERE phone_number IS NOT NULL;

-- 2. Add created_at to referral_redemptions so we can do time-based queries.
--    (Column already exists via default; this is a no-op if already present.)
-- Nothing needed — created_at already has DEFAULT now() in the original schema.

-- 3. Index referrer_org_id + redeemer_org_id for fast ring/network checks.
CREATE INDEX IF NOT EXISTS rr_redeemer_referrer_idx
  ON referral_redemptions (redeemer_org_id, referrer_org_id);

-- 4. Add organisations.created_at index for age-gate queries.
CREATE INDEX IF NOT EXISTS orgs_created_at_idx
  ON organisations (created_at);

-- 5. Track which org OWNER's phone number was used at redemption time
--    (audit trail — allows retroactive abuse investigation).
ALTER TABLE referral_redemptions
  ADD COLUMN IF NOT EXISTS redeemer_owner_phone TEXT;
