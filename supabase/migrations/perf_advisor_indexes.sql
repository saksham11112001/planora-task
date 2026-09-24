-- ============================================================================
-- Performance advisor — the findings that reduce disk I/O
--
-- WHAT IS SKIPPED, AND WHY
--   The 26 auth_rls_initplan warnings and the multiple_permissive_policies
--   warnings are about RLS policy evaluation. This app queries through the
--   service role for essentially everything, which bypasses RLS, so those
--   policies almost never run. The advice is sound in general and worth
--   nothing here.
--
--   Of the ~40 unindexed foreign keys, only two are added. An index is not
--   free: every one is another structure to update on every insert, update
--   and delete. Adding forty of them to fix a disk-IO problem would make the
--   disk-IO problem worse. The two below sit on paths this app actually
--   exercises in bulk.
--
-- WHY THIS HELPS
--   An unused index still costs a write on every row change and still occupies
--   disk. Dropping one is pure reduction, and it is reversible — the CREATE
--   statement to put it back is in the comment beside each DROP.
--
-- RUN THIS OUTSIDE A TRANSACTION
--   CONCURRENTLY is used throughout so nothing takes a lock that blocks live
--   traffic. Postgres refuses CONCURRENTLY inside a transaction block, so run
--   this as plain statements (the Supabase SQL editor does that by default) —
--   do NOT wrap it in BEGIN/COMMIT.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — duplicate indexes. Pure win, no judgement needed.
-- ============================================================================
-- Two identical indexes on the same columns: both are maintained on every
-- write, only one can ever be chosen by the planner. In each pair below the
-- advisor independently reported the dropped one as never used, so the
-- survivor is the one actually serving queries.

-- keeps: msme_email_log_vendor_id_idx
DROP INDEX CONCURRENTLY IF EXISTS public.msme_email_log_vendor_idx;

-- keeps: idx_task_attachments_task
DROP INDEX CONCURRENTLY IF EXISTS public.idx_attachments_task;

-- keeps: idx_tasks_org_active_due  (the partial/active variant, which is the
-- one every board and list query actually filters on)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_tasks_org_due;


-- ============================================================================
-- SECTION 2 — CHECK BEFORE RUNNING SECTION 3
-- ============================================================================
-- "Never used" means never used SINCE STATISTICS WERE LAST RESET. Two traps:
--
--   1. A feature used monthly (invoicing at month end, partner payouts,
--      issue reports) can look unused for weeks and then matter.
--   2. An index backing a UNIQUE or PRIMARY KEY constraint enforces
--      correctness. Dropping it silently permits duplicate rows. It must
--      never be dropped for being "unused".
--
-- This lists every index named below together with how old the statistics are
-- and whether a constraint depends on it. Run it and read the output before
-- running section 3.

SELECT s.relname                AS table,
       s.indexrelname           AS index,
       s.idx_scan               AS times_used,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
       (i.indisunique OR i.indisprimary)              AS backs_a_constraint,
       (SELECT stats_reset FROM pg_stat_database WHERE datname = current_database())
                               AS stats_since
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.schemaname = 'public'
  AND s.idx_scan = 0
ORDER BY pg_relation_size(s.indexrelid) DESC;


-- ============================================================================
-- SECTION 3 — drop unused indexes on the HIGH-WRITE tables only
-- ============================================================================
-- Restricted on purpose to tables that are written constantly, where the
-- saving is real and repeated. Unused indexes on quiet tables (issue_reports,
-- partner_*, referral_*) are left alone: the saving is negligible and the
-- chance that a monthly feature needs them is not.
--
-- Skip any line that section 2 reported as backing a constraint.

-- tasks: the busiest table in the app
DROP INDEX CONCURRENTLY IF EXISTS public.idx_tasks_org_due;
  -- restore: CREATE INDEX CONCURRENTLY idx_tasks_org_due ON tasks (org_id, due_date);

-- task_attachments
DROP INDEX CONCURRENTLY IF EXISTS public.idx_attachments_task;
  -- restore: CREATE INDEX CONCURRENTLY idx_attachments_task ON task_attachments (task_id);

-- msme_vendors / msme_email_log: written in bulk on every reminder run
DROP INDEX CONCURRENTLY IF EXISTS public.idx_msme_vendors_is_deleted;
  -- restore: CREATE INDEX CONCURRENTLY idx_msme_vendors_is_deleted ON msme_vendors (is_deleted);
DROP INDEX CONCURRENTLY IF EXISTS public.msme_vendors_status_emailed_idx;
  -- restore: CREATE INDEX CONCURRENTLY msme_vendors_status_emailed_idx ON msme_vendors (status, last_emailed_at);

-- projects: three unused indexes on a small, rarely-read table
DROP INDEX CONCURRENTLY IF EXISTS public.idx_projects_org;
  -- restore: CREATE INDEX CONCURRENTLY idx_projects_org ON projects (org_id);
DROP INDEX CONCURRENTLY IF EXISTS public.idx_projects_client;
  -- restore: CREATE INDEX CONCURRENTLY idx_projects_client ON projects (client_id);
DROP INDEX CONCURRENTLY IF EXISTS public.idx_projects_member_ids;
  -- restore: CREATE INDEX CONCURRENTLY idx_projects_member_ids ON projects USING gin (member_ids);
DROP INDEX CONCURRENTLY IF EXISTS public.idx_projects_name_trgm;
  -- restore: CREATE INDEX CONCURRENTLY idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);

-- org_members: read on every single request, but never through this index
DROP INDEX CONCURRENTLY IF EXISTS public.idx_org_members_user_active;
  -- restore: CREATE INDEX CONCURRENTLY idx_org_members_user_active ON org_members (user_id, is_active);


-- ============================================================================
-- SECTION 4 — the two foreign keys worth indexing
-- ============================================================================
-- ca_task_instances.task_id is declared ON DELETE SET NULL. Every task delete
-- makes Postgres find the referencing rows, and with no index that is a full
-- scan of ca_task_instances — on every delete, and the Trash purge deletes in
-- bulk. This is the single most expensive missing index here.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ca_task_instances_task_id_idx
  ON public.ca_task_instances (task_id);

-- tasks.parent_recurring_id is walked by the daily recurring spawn and by the
-- calendar's occurrence lookup, both of which run across the whole table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_parent_recurring_id_idx
  ON public.tasks (parent_recurring_id)
  WHERE parent_recurring_id IS NOT NULL;


-- ============================================================================
-- SECTION 5 — confirm the effect
-- ============================================================================
-- Total index bytes before and after. Re-run section 2 in a week: anything
-- still at zero scans, on a table that has seen writes, is a safe drop.
SELECT pg_size_pretty(sum(pg_relation_size(indexrelid))) AS total_index_size
FROM pg_stat_user_indexes WHERE schemaname = 'public';
