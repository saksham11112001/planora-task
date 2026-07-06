-- MISSING MIGRATION — fixes production error caught by Sentry (July 6, 2026):
--   GET /api/clients → "column clients.is_archived does not exist"
--
-- Commit 05c882d ("fix: soft-delete clients instead of hard-delete") switched
-- the clients routes to soft-delete semantics (is_archived + deleted_at, same
-- pattern as tasks) but the accompanying migration was never created, so
-- production lacks the columns and every clients list load 500s.
--
-- Safe to run immediately: additive, idempotent, default false keeps all
-- existing clients visible.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;
