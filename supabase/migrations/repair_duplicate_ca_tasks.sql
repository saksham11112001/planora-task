-- ============================================================================
-- REPAIR: undo what the backfill created for periods already dealt with
--
-- THE SITUATION
--   Clicking "Spawn tasks" walked each assignment back to the date it was
--   created and made a task for every due date that had no ledger row — so
--   periods your team finished months ago (e.g. Accounting (Monthly), due
--   10 Apr) reappeared as fresh "To do" rows and are now showing overdue.
--
-- WHY MATCHING ON NAME + DATE IS NOT ENOUGH
--   The obvious rule — "delete it if an identical completed task exists" —
--   misses these. The new rows are built from the master task's CURRENT name
--   and CURRENT date, so if either was edited since the original was created,
--   the two no longer look identical even though they are the same obligation.
--   That is why this script does NOT rely on finding a twin.
--
-- WHAT IT USES INSTEAD — three facts that are true regardless of renaming:
--   1. The row was created by the backfill run (a timestamp you set).
--   2. The spawner created it, not a person (custom_fields._assignment_id).
--   3. Nobody has touched it: still 'To do', with no attachment, comment,
--      time log or subtask.
--   Anything a person has worked on is never a candidate, so no work can be
--   lost — the worst case is a row returning to Trash, which is reversible.
--
-- NOTHING IS DELETED
--   Rows are archived exactly the way the app's own delete works
--   (is_archived = true, deleted_at = now()), so they leave every list and sit
--   in Trash. Section 5 puts them back.
--   Archiving also matters technically: ca_task_instances.task_id is
--   ON DELETE SET NULL, so a real DELETE would discard the ledger record and
--   let the same period spawn AGAIN. Archiving keeps it.
--
-- ORDER OF PLAY
--   Sections 1-2 are READ-ONLY. Run them, read the output, decide the cutoff.
--   Then Section 3. Section 4 verifies. Section 5 undoes.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — set two values, then run. Read-only.
-- ============================================================================
--  backfill_from : when "Spawn tasks" was clicked (IST is +05:30). Only rows
--                  created at or after this are ever considered.
--  keep_due_from : the FIRST due date you want to KEEP. Anything due earlier
--                  is treated as a period already dealt with.
--                  e.g. '2026-09-01' keeps September's genuinely-missed tasks
--                  and clears April-August.

DROP VIEW IF EXISTS _ca_backfill_rows;
CREATE TEMP VIEW _ca_backfill_rows AS
WITH params AS (
  SELECT TIMESTAMPTZ '2026-09-21 00:00:00+05:30' AS backfill_from,
         DATE        '2026-09-01'                AS keep_due_from
)
SELECT t.id,
       t.org_id,
       t.client_id,
       t.title,
       t.due_date,
       t.created_at,
       (t.due_date < p.keep_due_from) AS is_old_period,
       -- Informational only — never used to decide. Shows whether an older
       -- task for the same client and due date already exists, in any state.
       (SELECT o.status FROM tasks o
         WHERE o.org_id = t.org_id
           AND o.client_id IS NOT DISTINCT FROM t.client_id
           AND o.due_date = t.due_date
           AND o.id <> t.id
           AND o.created_at < t.created_at
           AND o.custom_fields->>'_ca_compliance' = 'true'
         ORDER BY o.created_at ASC LIMIT 1) AS older_twin_status
FROM tasks t, params p
WHERE t.custom_fields->>'_ca_compliance' = 'true'
  AND t.parent_task_id IS NULL
  AND COALESCE(t.is_archived, false) = false
  AND t.created_at >= p.backfill_from            -- created by the backfill
  AND t.status = 'todo'                          -- untouched
  AND t.custom_fields ? '_assignment_id'         -- spawner-created
  AND NOT EXISTS (SELECT 1 FROM task_attachments a WHERE a.task_id  = t.id)
  AND NOT EXISTS (SELECT 1 FROM task_comments    c WHERE c.task_id  = t.id)
  AND NOT EXISTS (SELECT 1 FROM time_logs        tl WHERE tl.task_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM tasks            s WHERE s.parent_task_id = t.id);


-- ============================================================================
-- SECTION 2 — LOOK FIRST. Read-only. This is the important step.
-- ============================================================================

-- 2a. Everything the backfill created, by due month.
--     "will_archive" is what Section 3 acts on; "will_keep" stays.
SELECT to_char(due_date,'YYYY-MM')                      AS due_month,
       count(*)                                         AS tasks,
       count(*) FILTER (WHERE is_old_period)            AS will_archive,
       count(*) FILTER (WHERE NOT is_old_period)        AS will_keep,
       count(*) FILTER (WHERE older_twin_status IS NOT NULL) AS has_older_twin
FROM _ca_backfill_rows
GROUP BY 1 ORDER BY 1;

-- 2b. Grand total for the run.
SELECT count(*) FILTER (WHERE is_old_period)     AS total_will_archive,
       count(*) FILTER (WHERE NOT is_old_period) AS total_will_keep
FROM _ca_backfill_rows;

-- 2c. The actual rows to be archived — check a few against the app.
--     older_twin_status 'completed' confirms the period was already handled.
SELECT b.title, c.name AS client, b.due_date, b.older_twin_status, b.created_at
FROM _ca_backfill_rows b
LEFT JOIN clients c ON c.id = b.client_id
WHERE b.is_old_period
ORDER BY b.due_date, c.name, b.title
LIMIT 100;

-- 2d. SAFETY ASSERTION — must return zero rows.
--     Proves nothing being archived has any work attached to it.
SELECT 'UNSAFE: has work attached' AS problem, b.id, b.title
FROM _ca_backfill_rows b
WHERE b.is_old_period
  AND (EXISTS (SELECT 1 FROM task_attachments a WHERE a.task_id = b.id)
    OR EXISTS (SELECT 1 FROM task_comments    c WHERE c.task_id = b.id)
    OR EXISTS (SELECT 1 FROM time_logs       tl WHERE tl.task_id = b.id));


-- ============================================================================
-- SECTION 3 — THE CLEANUP. Only after Section 2 looks right.
-- ============================================================================

BEGIN;

  UPDATE tasks t
  SET    is_archived = true,
         deleted_at  = now()
  FROM   _ca_backfill_rows b
  WHERE  t.id = b.id
    AND  b.is_old_period
    AND  COALESCE(t.is_archived, false) = false;   -- idempotent

  -- Guard: nothing completed, and nothing with work on it, may have been
  -- caught. If this raises, the whole transaction rolls back.
  DO $$
  DECLARE bad int;
  BEGIN
    SELECT count(*) INTO bad
    FROM tasks t
    WHERE t.is_archived = true
      AND t.deleted_at > now() - interval '2 minutes'
      AND (t.status <> 'todo'
        OR EXISTS (SELECT 1 FROM task_attachments a WHERE a.task_id = t.id)
        OR EXISTS (SELECT 1 FROM task_comments    c WHERE c.task_id = t.id)
        OR EXISTS (SELECT 1 FROM time_logs       tl WHERE tl.task_id = t.id));
    IF bad > 0 THEN
      RAISE EXCEPTION 'ABORTED: % archived row(s) were not untouched to-dos', bad;
    END IF;
  END $$;

COMMIT;


-- ============================================================================
-- SECTION 4 — VERIFY (after committing)
-- ============================================================================

-- 4a. How many went to Trash just now.
SELECT count(*) AS archived_now
FROM tasks
WHERE is_archived = true
  AND deleted_at > now() - interval '15 minutes'
  AND custom_fields->>'_ca_compliance' = 'true';

-- 4b. What the team sees now: remaining overdue CA to-dos by month.
--     The old periods should be gone; September should remain.
SELECT to_char(due_date,'YYYY-MM') AS due_month, count(*) AS still_to_do
FROM tasks
WHERE custom_fields->>'_ca_compliance' = 'true'
  AND COALESCE(is_archived,false) = false
  AND status = 'todo'
  AND due_date < CURRENT_DATE
GROUP BY 1 ORDER BY 1;


-- ============================================================================
-- SECTION 5 — UNDO (restores everything this archived in the last hour)
-- ============================================================================
-- BEGIN;
--   UPDATE tasks
--   SET    is_archived = false, deleted_at = NULL
--   WHERE  is_archived = true
--     AND  deleted_at > now() - interval '1 hour'
--     AND  custom_fields->>'_ca_compliance' = 'true'
--     AND  status = 'todo';
-- COMMIT;
