-- Add per-user permission overrides to org_members.
-- NULL means "use the org role_permissions default for this user's role".
-- When set, it is a flat map of { permission_key: boolean } containing ONLY
-- the permissions that have been explicitly overridden for this user.
-- The server resolves: user override → role default → hardcoded default.

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

COMMENT ON COLUMN org_members.permissions IS
  'Per-user permission overrides (flat JSON: { "tasks.create": true/false }).
   NULL = use org role_permissions defaults for this user''s role.
   Only overridden keys are stored; unset keys fall back to role default.';
