-- ============================================================================
-- ca_client_assignments: start_date / end_date bounds
--
-- WHY
--   Step 2 (Client Setup) has "Start date" and "End date" inputs per task. The
--   end date was never persisted anywhere — the column did not exist, the API
--   did not accept it, and the spawner did not read it — so a firm winding down
--   a client would set an end date, see "Assignments saved", and still get a
--   fresh set of tasks the following year.
--
--   start_date is also declared here. It is READ by caComplianceSpawn.ts and
--   /api/ca/trigger and WRITTEN by POST /api/ca/assignments, but no migration
--   ever created it — it was added straight to production by hand. That is the
--   schema drift this folder's README warns about: it works today and would
--   silently break any environment rebuilt from these files. IF NOT EXISTS
--   makes re-declaring it a no-op on production while fixing the record.
--
-- SEMANTICS (both bounds are INCLUSIVE, and both are optional)
--   start_date  spawn nothing whose due date falls BEFORE it
--   end_date    spawn nothing whose due date falls AFTER it
--
--   So end_date = 2026-07-31 keeps every obligation due on or before 31 Jul
--   2026 and stops everything after it. Existing spawned tasks are untouched:
--   this bounds future spawning only, which is the point — a firm winding down
--   a client still has to finish the work already on the board.
--
--   NULL end_date means "no end", i.e. exactly today's behaviour. Every
--   existing row therefore keeps working unchanged after this runs.
--
--   Ending an assignment is deliberately NOT the same as deactivating it
--   (is_active = false) or unchecking the task in Step 2, both of which drop
--   the assignment and the history with it.
-- ============================================================================

ALTER TABLE ca_client_assignments
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE;

-- Guard against a reversed range, which would silently spawn nothing at all.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ca_client_assignments_date_range_check'
  ) THEN
    ALTER TABLE ca_client_assignments
      ADD CONSTRAINT ca_client_assignments_date_range_check
      CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
  END IF;
END $$;

-- VERIFY
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'ca_client_assignments'
--     AND column_name IN ('start_date', 'end_date');
--
-- Expect two DATE rows, both nullable. If start_date comes back as something
-- other than DATE, production was hand-built with a different type — reconcile
-- before deploying, because the spawner compares it against 'YYYY-MM-DD'.
