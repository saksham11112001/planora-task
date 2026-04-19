-- ============================================================================
-- Full-text / trigram indexes for ILIKE '%q%' search in /api/search
-- The search route fires three ilike('%q%') queries on every keystroke.
-- Without trigram indexes, PostgreSQL falls back to a sequential scan — fatal
-- at 10k+ tasks/org.
-- ============================================================================

-- Enable the pg_trgm extension (no-op if already enabled).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- tasks.title — most frequently searched column
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm
  ON tasks USING GIN (title gin_trgm_ops)
  WHERE is_archived = false;

-- projects.name
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
  ON projects USING GIN (name gin_trgm_ops)
  WHERE is_archived = false;

-- clients.name
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
  ON clients USING GIN (name gin_trgm_ops);
