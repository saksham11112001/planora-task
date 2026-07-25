-- Product-scoped mailers.
--
-- Records WHICH product a user signed up through, so we never send upFloat
-- task-manager usage emails (task assigned, digests, approvals, reminders…)
-- to someone who only ever signed up for MSME Tracker or the Partner Program.
-- Promotional / cross-sell emails are NOT affected — those still go to
-- everyone (subject to marketing_opt_out), which is how we invite MSME and
-- partner users to try the main app.
--
-- Existing users default to 'app', so current behaviour is unchanged.
-- Idempotent: safe to re-run.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_product text NOT NULL DEFAULT 'app';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_signup_product_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_signup_product_check
      CHECK (signup_product IN ('app', 'msme', 'partner'));
  END IF;
END $$;

-- Look-ups are by email when deciding whether an email may be sent.
CREATE INDEX IF NOT EXISTS idx_users_email_signup_product
  ON users (email, signup_product);

-- Backfill: anyone who is a standalone partner AND has no org membership only
-- ever used the partner portal, so mark them 'partner' (never overwrite 'msme').
UPDATE users u
SET    signup_product = 'partner'
WHERE  u.signup_product = 'app'
  AND  EXISTS (SELECT 1 FROM standalone_partners sp WHERE lower(sp.email) = lower(u.email))
  AND  NOT EXISTS (SELECT 1 FROM org_members om WHERE om.user_id = u.id AND om.is_active);

-- VERIFY
-- SELECT signup_product, count(*) FROM users GROUP BY 1;
