-- ============================================================
-- PLANORA MIGRATION — Run in Supabase SQL Editor BEFORE deploying
-- ============================================================

-- 1. Add approver_id to tasks
--    Referenced throughout the codebase but was missing from schema.
--    approver_id = the specific person who must approve this task.
--    (approved_by = who actually approved it — that already exists)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_approver ON tasks(approver_id);

-- 2. Add created_at to org_members
--    Used in AppLayout admin fallback query to find the most recently
--    created membership when is_active = false.
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Done. Deploy the code zip after running this.
