-- ============================================================================
-- Diagnose: "ITR (with Audit)" — some client tasks moved to 21 Nov 2026,
-- the rest are still 31 Oct 2026.
--
-- Run the whole file in the Supabase SQL editor. It only READS — nothing is
-- changed. Send me all four result sets.
-- ============================================================================


-- ── 1. What does the master row actually say now? ───────────────────────────
-- If `dates` still shows 2026-10-31, the master save itself did not land and
-- the problem is upstream of propagation.
select
  m.id,
  m.name,
  m.is_user_saved,
  m.dates,                      -- the month -> due-date map
  m.days_before_due,
  m.updated_at
from ca_master_tasks m
where m.name ilike '%ITR%Audit%'
order by m.name;


-- ── 2. Every spawned task for it, with its instance record beside it ────────
-- THE KEY RESULT. For each client task we show:
--   task_due      — what the task says (what Harshit sees in the list)
--   instance_due  — what the spawn-dedup record says
--
-- These two MUST agree. Where they disagree, propagation moved the task but
-- the matching ca_task_instances row failed to follow — and that failure is
-- only written to a server log, never shown to the user. A stale instance
-- also means the nightly spawner can create a duplicate, because it dedupes
-- on (assignment_id, due_date).
select
  c.name                              as client,
  t.title,
  t.status,
  t.is_archived,
  t.due_date                          as task_due,
  i.due_date                          as instance_due,
  case
    when i.id is null               then 'NO INSTANCE ROW'
    when i.due_date = t.due_date    then 'in sync'
    else                                 'OUT OF SYNC'
  end                                 as sync_state,
  t.created_at                        as task_created,
  t.updated_at                        as task_updated
from tasks t
left join clients            c on c.id = t.client_id
left join ca_task_instances  i on i.task_id = t.id
where t.title ilike '%ITR%Audit%'
  and t.parent_task_id is null
  and t.custom_fields @> '{"_ca_compliance": true}'
order by t.due_date, c.name;


-- ── 3. Count by due date and status ─────────────────────────────────────────
-- A quick shape of the split: how many on each date, and whether the ones
-- left behind are the completed or archived ones (which propagation skips on
-- purpose) or ordinary open tasks (which it should have moved).
select
  t.due_date,
  t.status,
  coalesce(t.is_archived, false) as archived,
  count(*)                       as how_many
from tasks t
where t.title ilike '%ITR%Audit%'
  and t.parent_task_id is null
  and t.custom_fields @> '{"_ca_compliance": true}'
group by 1, 2, 3
order by 1, 2;


-- ── 4. Duplicates? ──────────────────────────────────────────────────────────
-- If the instance sync failed, the nightly spawner may since have created a
-- SECOND task for the same client. Any row returned here is a duplicate that
-- needs cleaning up before anything else is changed.
select
  t.client_id,
  c.name            as client,
  t.title,
  count(*)          as copies,
  array_agg(t.due_date order by t.due_date) as due_dates,
  array_agg(t.id    order by t.due_date)    as task_ids
from tasks t
left join clients c on c.id = t.client_id
where t.title ilike '%ITR%Audit%'
  and t.parent_task_id is null
  and t.custom_fields @> '{"_ca_compliance": true}'
  and coalesce(t.is_archived, false) = false
group by t.client_id, c.name, t.title
having count(*) > 1;
