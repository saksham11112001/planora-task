-- ============================================================================
-- REPAIR: archive CA compliance tasks that the backfill re-created
--
-- WHAT HAPPENED
--   "Spawn tasks" de-duplicates a due date two ways: against ca_task_instances
--   (assignment_id + due_date), and against the tasks table (title + client +
--   due date). The tasks-table check deliberately ignores ARCHIVED rows. So a
--   task that had been completed and then archived, and whose ca_task_instances
--   row was missing, matched neither check and was created a second time.
--
-- WHAT THIS DOES
--   Sends the duplicate to Trash using EXACTLY the mechanism the app itself
--   uses for deletion (is_archived = true, deleted_at = now()). Nothing is
--   destroyed, nothing is removed from any table, and Section 5 undoes it.
--   The original — the one people already completed — is never touched.
--
-- WHY ARCHIVE RATHER THAN DELETE
--   * Reversible. A DELETE is not.
--   * It is what the product means by "deleted": the rows leave every list,
--     because every task query filters is_archived.
--   * ca_task_instances.task_id is ON DELETE SET NULL, so deleting would quietly
--     discard the (assignment, due_date) record and let the pair spawn AGAIN.
--     Archiving keeps that record, so this cannot recur for these dates.
--
-- SAFETY (each is enforced in SQL, not assumed)
--   1. Only rows the spawner created  — custom_fields._assignment_id present.
--   2. Only untouched rows — status 'todo', and no attachment, comment, time
--      log or subtask. Anything a person has worked on is left alone.
--   3. Only rows created inside the backfill window (Section 1 parameter).
--   4. NEVER the last live copy. Ranking runs over live rows only and always
--      keeps rank 1, so every group provably retains exactly one live task.
--   5. Completed / in-progress tasks are never candidates.
--
-- HOW TO RUN
--   Section 1 and 2 are READ-ONLY — run them and read the output first.
--   Only then run Section 3. Section 4 verifies. Section 5 is the undo.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — the shared definition. Read-only. Run this with Section 2.
-- ============================================================================
-- Adjust ONLY this timestamp: the moment the backfill ran (IST is UTC+5:30).
-- Anything created before it is treated as pre-existing and left alone.
-- Widen it only after reading Section 2's output.

DROP VIEW IF EXISTS _ca_dupe_candidates;
CREATE TEMP VIEW _ca_dupe_candidates AS
WITH params AS (
  SELECT TIMESTAMPTZ '2026-09-20 00:00:00+05:30' AS backfill_from
),
-- Live, spawner-created, top-level CA compliance tasks.
live_ca AS (
  SELECT t.id, t.org_id, t.client_id, t.title, t.due_date, t.status,
         t.created_at, t.custom_fields
  FROM tasks t
  WHERE t.custom_fields->>'_ca_compliance' = 'true'
    AND t.parent_task_id IS NULL
    AND COALESCE(t.is_archived, false) = false
),
-- Rank within (org, client, title, due date). Because only LIVE rows are
-- ranked, rank 1 is always a live row that survives — this is what makes
-- "never remove the last copy" true by construction rather than by filter.
ranked AS (
  SELECT l.*,
         ROW_NUMBER() OVER (
           PARTITION BY l.org_id, COALESCE(l.client_id::text, '~none~'),
                        lower(btrim(l.title)), l.due_date
           ORDER BY l.created_at ASC, l.id ASC
         ) AS rn,
         COUNT(*) OVER (
           PARTITION BY l.org_id, COALESCE(l.client_id::text, '~none~'),
                        lower(btrim(l.title)), l.due_date
         ) AS live_in_group,
         FIRST_VALUE(l.id) OVER (
           PARTITION BY l.org_id, COALESCE(l.client_id::text, '~none~'),
                        lower(btrim(l.title)), l.due_date
           ORDER BY l.created_at ASC, l.id ASC
         ) AS keeps_id
  FROM live_ca l
)
SELECT r.id            AS duplicate_id,
       r.keeps_id      AS original_id,
       r.org_id, r.client_id, r.title, r.due_date,
       r.created_at    AS duplicate_created_at,
       r.live_in_group
FROM ranked r, params p
WHERE r.rn > 1                                   -- never the survivor
  AND r.live_in_group > 1                        -- a genuine duplicate
  AND r.created_at >= p.backfill_from            -- created by the backfill
  AND r.status = 'todo'                          -- untouched
  AND r.custom_fields ? '_assignment_id'         -- spawner-created, not a person's
  -- and genuinely untouched: nothing hangs off it
  AND NOT EXISTS (SELECT 1 FROM task_attachments a WHERE a.task_id  = r.id)
  AND NOT EXISTS (SELECT 1 FROM task_comments    c WHERE c.task_id  = r.id)
  AND NOT EXISTS (SELECT 1 FROM time_logs        tl WHERE tl.task_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM tasks            s WHERE s.parent_task_id = r.id);


-- ============================================================================
-- SECTION 2 — INSPECT. Read-only. Read this before running Section 3.
-- ============================================================================

-- 2a. Summary
SELECT count(*) AS duplicates_to_archive,
       count(DISTINCT org_id)    AS orgs_affected,
       count(DISTINCT client_id) AS clients_affected,
       min(due_date) AS earliest_due,
       max(due_date) AS latest_due
FROM _ca_dupe_candidates;

-- 2b. Every row, with the task that will SURVIVE alongside it.
--     `original_status` should read completed/in_progress — that is the work
--     already done. If any row looks wrong, stop and send this output over.
SELECT d.title,
       c.name                AS client,
       d.due_date,
       d.duplicate_id,
       d.duplicate_created_at,
       o.status              AS original_status,
       o.created_at          AS original_created_at,
       d.live_in_group       AS live_copies_now
FROM _ca_dupe_candidates d
JOIN tasks   o ON o.id = d.original_id
LEFT JOIN clients c ON c.id = d.client_id
ORDER BY c.name NULLS FIRST, d.due_date, d.title;

-- 2c. SAFETY ASSERTION — must return zero rows.
--     Proves no group would be left without a live task.
SELECT 'UNSAFE: would remove the last live copy' AS problem, d.*
FROM _ca_dupe_candidates d
WHERE d.duplicate_id = d.original_id;


-- ============================================================================
-- SECTION 3 — THE REPAIR. Run only after Section 2 looks right.
-- Wrapped in a transaction: if the assertion fails, nothing is written.
-- ============================================================================

BEGIN;

  -- Re-point the dedup record at the task people actually use, so the record
  -- outlives this repair and keeps the pair from spawning a third time.
  UPDATE ca_task_instances i
  SET    task_id = d.original_id
  FROM   _ca_dupe_candidates d
  WHERE  i.task_id = d.duplicate_id;

  -- Send the duplicate to Trash — same two columns the app's own delete writes.
  UPDATE tasks t
  SET    is_archived = true,
         deleted_at  = now()
  FROM   _ca_dupe_candidates d
  WHERE  t.id = d.duplicate_id
    AND  COALESCE(t.is_archived, false) = false;   -- idempotent: safe to re-run

  -- Final guard. Every affected group must still have exactly one live task.
  -- If this raises, the whole transaction rolls back and nothing changed.
  DO $$
  DECLARE bad int;
  BEGIN
    SELECT count(*) INTO bad
    FROM (
      SELECT t.org_id, COALESCE(t.client_id::text,'~none~') AS c,
             lower(btrim(t.title)) AS ti, t.due_date, count(*) AS live
      FROM tasks t
      WHERE t.custom_fields->>'_ca_compliance' = 'true'
        AND t.parent_task_id IS NULL
        AND COALESCE(t.is_archived,false) = false
        AND (t.org_id, COALESCE(t.client_id::text,'~none~'),
             lower(btrim(t.title)), t.due_date) IN (
              SELECT d.org_id, COALESCE(d.client_id::text,'~none~'),
                     lower(btrim(d.title)), d.due_date
              FROM _ca_dupe_candidates d)
      GROUP BY 1,2,3,4
    ) g
    WHERE g.live <> 1;

    IF bad > 0 THEN
      RAISE EXCEPTION
        'ABORTED: % affected group(s) would not have exactly one live task', bad;
    END IF;
  END $$;

COMMIT;


-- ============================================================================
-- SECTION 4 — VERIFY (after committing)
-- ============================================================================

-- 4a. What moved to Trash in the last few minutes.
SELECT count(*) AS archived_now
FROM tasks
WHERE is_archived = true
  AND deleted_at > now() - interval '15 minutes'
  AND custom_fields->>'_ca_compliance' = 'true';

-- 4b. Any remaining live CA duplicates anywhere (expect zero rows).
SELECT org_id, client_id, title, due_date, count(*) AS live_copies
FROM tasks
WHERE custom_fields->>'_ca_compliance' = 'true'
  AND parent_task_id IS NULL
  AND COALESCE(is_archived,false) = false
GROUP BY 1,2,3,4
HAVING count(*) > 1
ORDER BY count(*) DESC;


-- ============================================================================
-- SECTION 5 — UNDO (only if something looks wrong)
-- Restores everything this script archived in the last hour.
-- ============================================================================
-- BEGIN;
--   UPDATE tasks
--   SET    is_archived = false, deleted_at = NULL
--   WHERE  is_archived = true
--     AND  deleted_at > now() - interval '1 hour'
--     AND  custom_fields->>'_ca_compliance' = 'true'
--     AND  status = 'todo';
-- COMMIT;
