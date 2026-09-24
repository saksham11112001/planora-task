-- ============================================================================
-- Supabase database linter — the findings worth acting on
--
-- Triaged against the app on 24 Sep 2026. Two facts shape everything below:
--
--   1. The app makes NO .rpc() calls at all. Nothing in application code
--      invokes these functions over the REST API, so revoking EXECUTE from
--      anon/authenticated cannot break a code path that exists.
--
--   2. user_org_id() IS called from inside RLS policies. Policy expressions
--      are evaluated as the QUERYING role, so that role needs EXECUTE. The
--      linter flags it anyway. Revoking it would break RLS across the app —
--      see section 3.
--
-- Safe to run in one go. Each statement is independent and idempotent.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — the one with real teeth
-- ============================================================================
-- compact_stage_orders is SECURITY DEFINER (runs as owner, ignores RLS), takes
-- a template id, and writes. It is reachable by any signed-in user at
-- /rest/v1/rpc/compact_stage_orders — which means a member of one firm could
-- pass another firm's template id and have it act with owner privileges,
-- straight past every org check the API layer makes.
--
-- The app never calls it. Close it.

REVOKE EXECUTE ON FUNCTION public.compact_stage_orders(uuid, integer) FROM anon, authenticated;

-- handle_new_user is a TRIGGER function. Triggers fire as the table owner, so
-- the calling role never needs EXECUTE — granting it only exposes the function
-- at /rest/v1/rpc/handle_new_user, where it was never meant to be reachable.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;


-- ============================================================================
-- SECTION 2 — pin search_path on SECURITY DEFINER functions
-- ============================================================================
-- A SECURITY DEFINER function with a mutable search_path is the classic
-- Postgres escalation: anyone able to create an object in a schema that sits
-- earlier on the search path can shadow a table or function the definer calls,
-- and their code then runs with the definer's privileges. Pinning the path
-- removes the ambiguity. No behavioural change — everything here lives in
-- public, and pg_temp is listed last deliberately so a temp object cannot
-- shadow a real one.

ALTER FUNCTION public.compact_stage_orders(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.cascade_stage_dates()        SET search_path = public, pg_temp;
ALTER FUNCTION public.update_invoices_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at()          SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column()   SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()            SET search_path = public, pg_temp;
ALTER FUNCTION public.user_org_id()                SET search_path = public, pg_temp;
ALTER FUNCTION public.user_org_role()              SET search_path = public, pg_temp;


-- ============================================================================
-- SECTION 3 — DO NOT do what the linter says here
-- ============================================================================
-- The linter flags user_org_id() and user_org_role() as executable by anon and
-- authenticated, and suggests revoking EXECUTE.
--
-- DO NOT. Both are called from inside RLS policies:
--     create_org_feature_settings.sql:17  USING (org_id = public.user_org_id())
--     add_notification_queue.sql:22       USING (org_id = public.user_org_id())
--     fix_rls_users_read.sql:26           WHERE org_id = public.user_org_id()
--
-- A policy expression runs as the querying role. Revoke EXECUTE from
-- `authenticated` and every one of those policies raises a permission error,
-- which fails the query it was protecting. The app breaks.
--
-- They are also harmless to expose: both read the CALLER's own identity and
-- return their own org id or role. An anon caller gets NULL. There is nothing
-- to leak. Section 2 already gave them a fixed search_path, which is the part
-- that actually mattered.
--
-- Leave the grants alone. This warning stays on the report permanently, and
-- that is the correct outcome.


-- ============================================================================
-- SECTION 4 — also leave pg_trgm where it is
-- ============================================================================
-- The linter wants pg_trgm moved out of public. Indexes and functions here
-- resolve it through the public search path, and the ALTER in section 2 pins
-- that path to `public, pg_temp`. Moving the extension without also updating
-- every dependant breaks text search. The finding is hygiene, not a
-- vulnerability, and the risk of the fix exceeds the risk of the warning.
