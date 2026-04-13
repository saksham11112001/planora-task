-- Add per-member "view all tasks" override flag.
-- When true, the member sees all org tasks regardless of role
-- (same visibility as owner/admin). Only owner/admin can set this.
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS can_view_all_tasks BOOLEAN NOT NULL DEFAULT FALSE;
