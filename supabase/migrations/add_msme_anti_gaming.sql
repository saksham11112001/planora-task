-- Anti-gaming: vendor slots are permanently consumed even after deletion.
-- Deletion now soft-deletes (is_deleted = true); the slot still counts toward the org limit.
-- Re-adding the same vendor email reactivates the existing slot rather than consuming a new one.

ALTER TABLE msme_vendors
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Index so the GET query (filtering is_deleted = false) stays fast
CREATE INDEX IF NOT EXISTS idx_msme_vendors_org_active
  ON msme_vendors(org_id, is_deleted)
  WHERE is_deleted = false;
