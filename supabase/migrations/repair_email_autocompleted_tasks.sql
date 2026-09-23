-- ============================================================================
-- REPAIR: tasks that marked themselves completed overnight
--
-- WHAT HAPPENED
--   Every "due soon" reminder email carries a one-click "Mark complete" link.
--   Opening that link is an HTTP GET, and the GET does the write immediately —
--   no confirmation page, no POST.
--
--   Mail security scanners (Microsoft Defender Safe Links, Mimecast, Proofpoint,
--   Barracuda) and some mail apps' link previewers fetch EVERY link in EVERY
--   message to check it is safe. Each of those fetches completed a task. The
--   daily reminder sends one email per due task, so a mailbox with link
--   scanning turned on completed the user's whole reminder batch in one sweep —
--   which is why it hit one team member and not the others, and why it happened
--   in the morning when the reminders land.
--
--   The token is valid for seven days and is not single-use, so a re-scan of an
--   older email can do it again.
--
-- HOW THESE ROWS ARE IDENTIFIED
--   When a person completes a task in the app, the API writes an activity_log
--   row ('task.completed'). The email-link path writes NO activity_log row at
--   all. So: completed, but with no completion ever logged = not completed by
--   a human. That is the discriminator, and it does not depend on guessing
--   timestamps.
--
--   Rows with approved_by set are excluded — those went through the approval
--   flow, which is a different action and may well have been genuine.
--
-- ONE THING THIS CANNOT KNOW
--   The prior status is not recorded anywhere for these rows, so Section 3
--   restores them to 'todo'. If some were 'in_review', they will come back as
--   'todo' and need re-submitting. Section 2c shows how many had an approval
--   step so you can judge the scale before running anything.
--
-- ORDER OF PLAY
--   Sections 1-2 are READ-ONLY. Run them and read the output first.
--   Section 3 restores. Section 4 verifies. Section 5 undoes Section 3.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — set the window, then run. Read-only.
-- ============================================================================
--   since : how far back to look. Start with the last 2 days. Widen only if
--           Section 2 shows the problem goes back further (it can: tokens live
--           for 7 days, so an older email re-scanned would show up earlier).

DROP VIEW IF EXISTS _email_autocompleted;
CREATE TEMP VIEW _email_autocompleted AS
WITH params AS (
  SELECT (now() - interval '2 days') AS since
)
SELECT t.id,
       t.org_id,
       t.title,
       t.assignee_id,
       t.due_date,
       t.completed_at,
       t.approval_required
FROM tasks t, params p
WHERE t.status = 'completed'
  AND t.completed_at >= p.since
  AND COALESCE(t.is_archived, false) = false
  -- Not completed through the approval flow.
  AND t.approved_by IS NULL
  -- The tell: the app logs every human completion; the email link logs nothing.
  AND NOT EXISTS (
        SELECT 1 FROM activity_log a
        WHERE a.entity_type = 'task'
          AND a.entity_id   = t.id
          AND a.action IN ('task.completed', 'task.status_changed')
          AND a.created_at >= p.since
      );


-- ============================================================================
-- SECTION 2 — LOOK FIRST. Read-only. This is the important step.
-- ============================================================================

-- 2a. Who was hit, and how tightly clustered. A human cannot complete dozens of
--     tasks inside one minute; a scanner can. A large count in "distinct_minutes
--     = 1 or 2" is the signature.
SELECT u.name                                   AS assignee,
       u.email,
       count(*)                                 AS auto_completed,
       min(e.completed_at)                      AS first_at,
       max(e.completed_at)                      AS last_at,
       count(DISTINCT date_trunc('minute', e.completed_at)) AS distinct_minutes
FROM _email_autocompleted e
LEFT JOIN users u ON u.id = e.assignee_id
GROUP BY u.name, u.email
ORDER BY auto_completed DESC;

-- 2b. Sanity check — genuine completions in the SAME window, for contrast.
--     These have an activity_log row and are NOT touched by Section 3.
SELECT count(*) AS genuine_completions_same_window
FROM tasks t
WHERE t.status = 'completed'
  AND t.completed_at >= now() - interval '2 days'
  AND EXISTS (SELECT 1 FROM activity_log a
              WHERE a.entity_type='task' AND a.entity_id=t.id
                AND a.action IN ('task.completed','task.status_changed'));

-- 2c. How many will come back as 'todo' that previously needed approval.
--     These are the ones that may need re-submitting.
SELECT count(*) FILTER (WHERE approval_required)     AS had_approval_step,
       count(*) FILTER (WHERE NOT approval_required) AS plain_tasks,
       count(*)                                      AS total_to_restore
FROM _email_autocompleted;

-- 2d. The actual rows. Check a handful against what the person says they did.
SELECT e.title, u.name AS assignee, e.due_date, e.completed_at
FROM _email_autocompleted e
LEFT JOIN users u ON u.id = e.assignee_id
ORDER BY e.completed_at, e.title
LIMIT 100;


-- ============================================================================
-- SECTION 3 — RESTORE. Only after Section 2 looks right.
-- ============================================================================

BEGIN;

  UPDATE tasks t
  SET    status       = 'todo',
         completed_at = NULL
  FROM   _email_autocompleted e
  WHERE  t.id = e.id
    AND  t.status = 'completed';   -- idempotent: a re-run changes nothing

  -- Guard: nothing that carries a human completion may have been touched.
  -- If this raises, the whole transaction rolls back and nothing changes.
  DO $$
  DECLARE bad int;
  BEGIN
    SELECT count(*) INTO bad
    FROM tasks t
    WHERE t.status = 'todo'
      AND t.completed_at IS NULL
      AND EXISTS (SELECT 1 FROM activity_log a
                  WHERE a.entity_type='task' AND a.entity_id=t.id
                    AND a.action = 'task.completed'
                    AND a.created_at >= now() - interval '2 days');
    IF bad > 0 THEN
      RAISE EXCEPTION 'ABORTED: % row(s) with a real completion were reverted', bad;
    END IF;
  END $$;

COMMIT;


-- ============================================================================
-- SECTION 4 — VERIFY (after committing)
-- ============================================================================
SELECT count(*) AS still_auto_completed FROM _email_autocompleted;   -- expect 0


-- ============================================================================
-- SECTION 5 — UNDO (re-complete what Section 3 restored)
-- ============================================================================
-- Only useful immediately after Section 3, and only if it was run in error.
-- BEGIN;
--   UPDATE tasks SET status='completed', completed_at=now()
--   WHERE id IN (SELECT id FROM _email_autocompleted);
-- COMMIT;
