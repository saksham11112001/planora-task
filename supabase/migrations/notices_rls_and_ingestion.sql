-- ============================================================================
-- Notices: close the RLS hole, and prepare the table for automated ingestion.
--
-- client_notices was created without RLS. Every other table added since has
-- it enabled. Because the API routes use the service role, the app itself is
-- unaffected either way — but without RLS the table is readable and writable
-- by anyone holding the anon key, which ships in the browser bundle of every
-- page. That is the whole of a firm's tax-notice history.
--
-- Safe to run more than once.
-- ============================================================================


-- ── 1. RLS ──────────────────────────────────────────────────────────────────
-- Enabled with no policies = deny all for anon and authenticated. The service
-- role bypasses it, and that is the only path /api/notices uses.
alter table client_notices enable row level security;


-- ── 2. Columns for ingestion ────────────────────────────────────────────────

-- Where the row came from. Existing rows were all typed in by hand, and the
-- default backfills them correctly.
alter table client_notices
  add column if not exists source text not null default 'manual';

-- The notice's own identifier on the issuing portal (GST DIN, ITD DIN,
-- TRACES ticket). This is what makes re-ingestion idempotent: the same notice
-- arriving twice updates one row instead of creating a duplicate.
alter table client_notices
  add column if not exists external_ref text;

-- When an automated source last confirmed this notice still exists.
alter table client_notices
  add column if not exists synced_at timestamptz;

-- Who in the firm is handling it. Notices were previously tracked without an
-- owner, which is how one sits untouched until the response deadline passes.
alter table client_notices
  add column if not exists assigned_to uuid references users(id) on delete set null;

-- Demand raised by the notice, where it states one.
alter table client_notices
  add column if not exists demand_amount numeric(15,2);

-- The section quoted, e.g. '143(1)', '73', '200A'.
alter table client_notices
  add column if not exists section text;


-- ── 3. Idempotency ──────────────────────────────────────────────────────────
-- One row per external reference per org. Partial, so the many existing rows
-- with a null external_ref (all the manual ones) do not collide with each
-- other — in Postgres every null is distinct, but being explicit here also
-- keeps the index small.
create unique index if not exists client_notices_org_external_ref_uidx
  on client_notices(org_id, external_ref)
  where external_ref is not null;


-- ── 4. The index the list page needs ────────────────────────────────────────
-- The notices view is sorted by response deadline within an org, which is
-- exactly this.
create index if not exists client_notices_org_due_idx
  on client_notices(org_id, response_due);

create index if not exists client_notices_assigned_idx
  on client_notices(assigned_to)
  where assigned_to is not null;
