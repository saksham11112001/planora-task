-- Persist "user has explicitly saved this template" in the DB
-- instead of localStorage, so it survives browser clears / device changes.
ALTER TABLE ca_master_tasks
  ADD COLUMN IF NOT EXISTS is_user_saved BOOLEAN NOT NULL DEFAULT false;
