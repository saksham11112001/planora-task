-- Backfill users.signup_product for people mislabelled as 'app'.
--
-- WHY
-- signup_product used to be written only at org onboarding, inferred on the
-- CLIENT from sessionStorage / ?next= / hostname. If any of those was lost —
-- new tab, a redirect dropping the query string, landing on the apex domain
-- instead of msme.* — the user was silently recorded as 'app' and has been
-- receiving upFloat task-manager email (trial ending, digests, reminders) for
-- a product they never signed up for.
--
-- The code now stamps signup_product at ACCOUNT CREATION from the Host header
-- (app/auth/callback + app/api/auth/provision), so new signups are correct.
-- This migration repairs the existing rows.
--
-- SAFETY
-- The dangerous direction is marking a genuine app user as 'msme', which would
-- silence email they legitimately expect. So the rule is deliberately strict:
-- an org qualifies ONLY if it paid for an MSME pack AND has never created a
-- single task. An org that has used the task manager at all is left alone,
-- even if it also bought MSME.
--
-- Never downgrades to 'app' and never overwrites an existing non-'app' value.
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- DRY RUN — run this FIRST and eyeball the list before applying the UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT u.id, u.email, u.signup_product, o.name AS org_name
-- FROM   users u
-- JOIN   org_members om ON om.user_id = u.id AND om.is_active
-- JOIN   organisations o ON o.id = om.org_id
-- WHERE  u.signup_product = 'app'
--   AND  EXISTS (SELECT 1 FROM msme_pack_payments p
--                WHERE p.org_id = om.org_id AND p.status = 'paid')
--   AND  NOT EXISTS (SELECT 1 FROM tasks t WHERE t.org_id = om.org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MSME-only users: their org bought a pack and has never created a task.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE users u
SET    signup_product = 'msme'
WHERE  u.signup_product = 'app'
  AND  EXISTS (
         SELECT 1
         FROM   org_members om
         WHERE  om.user_id = u.id
           AND  om.is_active
           AND  EXISTS (SELECT 1 FROM msme_pack_payments p
                        WHERE p.org_id = om.org_id AND p.status = 'paid')
           AND  NOT EXISTS (SELECT 1 FROM tasks t WHERE t.org_id = om.org_id)
       );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Partner-only users: registered as a standalone partner, no org membership.
--    (Repeat of the backfill in add_signup_product.sql — re-run to catch anyone
--    who registered between that migration and this one.)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE users u
SET    signup_product = 'partner'
WHERE  u.signup_product = 'app'
  AND  EXISTS (SELECT 1 FROM standalone_partners sp WHERE lower(sp.email) = lower(u.email))
  AND  NOT EXISTS (SELECT 1 FROM org_members om WHERE om.user_id = u.id AND om.is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT signup_product, count(*) FROM users GROUP BY 1 ORDER BY 1;
