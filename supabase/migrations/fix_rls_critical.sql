-- ── Fix Supabase CRITICAL: RLS Disabled in Public ────────────────────────────
--
-- Strategy:
--   • Tables accessed ONLY via createAdminClient() (service_role):
--     → enable RLS with no policies. Service role bypasses RLS automatically,
--       so no routes break. Authenticated/anon users get zero access (correct).
--
--   • Tables also accessed via createClient() (authenticated session):
--     → enable RLS + add a SELECT policy scoped to the user's org.
--       Writes always go through createAdminClient() so only SELECT policy needed.
--
-- ── 1. email_daily_log ────────────────────────────────────────────────────────
-- Only ever touched by createAdminClient() inside Inngest functions.
alter table email_daily_log enable row level security;
-- No policies — service_role bypasses RLS; no authenticated access needed.

-- ── 2. org_settings ──────────────────────────────────────────────────────────
-- GET routes + permissionGate.ts use createClient(); writes use createAdminClient().
alter table org_settings enable row level security;

create policy "org_members_can_read_own_org_settings"
  on org_settings for select
  using (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── 3. client_document_types ─────────────────────────────────────────────────
-- Settings GET uses createClient(); portal + mutations use createAdminClient().
alter table client_document_types enable row level security;

create policy "org_members_can_read_document_types"
  on client_document_types for select
  using (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── 4. client_document_uploads ───────────────────────────────────────────────
-- All access via createAdminClient() (portal token flow + Inngest).
alter table client_document_uploads enable row level security;
-- No policies — service_role bypasses RLS; portal routes use admin client.

-- ── 5. client_doc_task_links ─────────────────────────────────────────────────
-- Single upsert via createAdminClient() in portal upload flow. No org_id column.
alter table client_doc_task_links enable row level security;
-- No policies — service_role bypasses RLS; no direct authenticated access.

-- ── 6. client_portal_tokens ──────────────────────────────────────────────────
-- All access via createAdminClient() (portal token validation + CA team routes).
alter table client_portal_tokens enable row level security;
-- No policies — service_role bypasses RLS; portal uses token hash lookup via admin client.

notify pgrst, 'reload schema';
