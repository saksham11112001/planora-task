-- Adds a per-member flag that grants access to the Monitor page
-- independently of their role or the org-level monitor.view permission.
-- Usage: owners/admins toggle this via Settings → Members.
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS can_view_monitor BOOLEAN NOT NULL DEFAULT FALSE;
