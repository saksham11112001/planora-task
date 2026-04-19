-- ============================================================================
-- FIX: org_members INSERT RLS privilege escalation (BUG-06)
--
-- PROBLEM: The original policy used WITH CHECK (true), meaning any authenticated
-- user could insert a row with any org_id and role — including granting themselves
-- owner access to a completely different organisation.
--
-- FIX: Restrict self-inserts only (user_id = auth.uid()). All admin/onboarding
-- code uses the service role key which bypasses RLS, so existing functionality
-- is unaffected.
-- ============================================================================

DROP POLICY IF EXISTS "members_insert" ON org_members;

CREATE POLICY "members_insert" ON org_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
