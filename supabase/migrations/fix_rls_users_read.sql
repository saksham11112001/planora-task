-- ============================================================================
-- FIX: users table SELECT RLS cross-org PII exposure (BUG-07)
--
-- PROBLEM: The original policy used USING (auth.uid() IS NOT NULL), meaning any
-- authenticated user from any organisation could read every row in the users
-- table — including email addresses, phone numbers, and WhatsApp opt-in status
-- belonging to users in completely unrelated organisations.
--
-- FIX: A user may only read:
--   1. Their own profile row, OR
--   2. Profiles of users who are active members of the same organisation.
--
-- This uses a subquery instead of a JOIN to stay compatible with the
-- SECURITY DEFINER functions already in use for RLS helpers.
-- ============================================================================

DROP POLICY IF EXISTS "users_read" ON users;

CREATE POLICY "users_read" ON users
  FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id
      FROM org_members
      WHERE org_id = public.user_org_id()
        AND is_active = true
    )
  );
