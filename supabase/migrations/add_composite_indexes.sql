-- ============================================================================
-- Composite indexes for hot query patterns identified in scalability audit.
-- All indexes are CONCURRENTLY-safe — run in production with CREATE INDEX
-- CONCURRENTLY if the table is large and you cannot afford a brief lock.
-- ============================================================================

-- ── org_members ──────────────────────────────────────────────────────────────
-- user_org_id() and user_org_role() fire on EVERY RLS policy check.
-- Both query: WHERE user_id = auth.uid() AND is_active = true
-- The existing idx_org_members_user(user_id) leaves is_active unindexed.
DROP INDEX IF EXISTS idx_org_members_user;
CREATE INDEX IF NOT EXISTS idx_org_members_user_active
  ON org_members(user_id, is_active);

-- Also add can_view_all_tasks to the composite so API route lookups
-- (SELECT org_id, role, can_view_all_tasks WHERE user_id=X AND is_active=true)
-- can be satisfied without a heap fetch.
CREATE INDEX IF NOT EXISTS idx_org_members_user_active_covering
  ON org_members(user_id, is_active) INCLUDE (org_id, role, can_view_all_tasks);

-- ── tasks — dashboard COUNT queries ──────────────────────────────────────────
-- Query 1+2: overdue / today counts
--   WHERE org_id=X AND is_archived!=true AND status IN (...) AND due_date </= today
CREATE INDEX IF NOT EXISTS idx_tasks_org_status_due
  ON tasks(org_id, status, due_date)
  WHERE is_archived = false;

-- Query 3: pending approval count for the current user
--   WHERE org_id=X AND assignee_id=user AND approval_status='pending'
CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee_approval
  ON tasks(org_id, assignee_id, approval_status);

-- Query 5: completed-this-month count
--   WHERE org_id=X AND status='completed' AND completed_at >= from30
CREATE INDEX IF NOT EXISTS idx_tasks_org_status_completed_at
  ON tasks(org_id, status, completed_at);

-- Query 6: total-tasks-this-month count
--   WHERE org_id=X AND created_at >= from30
CREATE INDEX IF NOT EXISTS idx_tasks_org_created_at
  ON tasks(org_id, created_at);

-- ── tasks — task-list page ────────────────────────────────────────────────────
-- WHERE org_id=X AND is_archived=false ORDER BY due_date
-- Partial index keeps it lean (only non-archived rows indexed).
CREATE INDEX IF NOT EXISTS idx_tasks_org_active_due
  ON tasks(org_id, due_date)
  WHERE is_archived = false;

-- ── tasks — daily-reminders Inngest function ──────────────────────────────────
-- WHERE status IN ('todo','in_progress') AND due_date BETWEEN in1 AND in3 AND is_archived=false
CREATE INDEX IF NOT EXISTS idx_tasks_active_due_reminder
  ON tasks(due_date, status)
  WHERE is_archived = false AND assignee_id IS NOT NULL;

-- ── projects — dashboard active projects ──────────────────────────────────────
-- WHERE org_id=X AND status='active' AND is_archived!=true ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_projects_org_status_updated
  ON projects(org_id, status, updated_at DESC)
  WHERE is_archived = false;

-- ── clients — dashboard recent clients ───────────────────────────────────────
-- WHERE org_id=X AND status='active' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_clients_org_status
  ON clients(org_id, status, created_at DESC);
