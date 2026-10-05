-- ============================================================================
-- Clean up the duplicate "ITR (with Audit)" tasks        (v2 — corrected)
--
-- What happened: the master due date moved 31 Oct 2026 -> 21 Nov 2026 on
-- 29 Sep. The spawned tasks were never moved with it, so on 30 Sep the nightly
-- spawner saw a due date it had no record of and created a second task for
-- every assignment. 40 clients now hold two.
--
-- The plan: KEEP the original task (staff have worked on it since 2 August,
-- with its subtasks and attachments) and move it to 21 Nov. ARCHIVE the empty
-- duplicate the cron created on 30 Sep. Nothing is deleted.
--
-- ----------------------------------------------------------------------------
-- WHAT CHANGED FROM v1, AND WHY IT MATTERS
--
--  1. v1's Section A2 was missing its FROM clause, so it failed with
--     'column "due_date" does not exist'. Fixed.
--
--  2. v1 told you to run Section B and then type COMMIT separately. That
--     DOES NOT WORK here: the Supabase SQL editor runs each "Run" in its own
--     transaction, so a COMMIT typed afterwards lands on a different
--     connection and the work is already gone.
--
--     Section B is now ONE self-contained run. The safety is a check at the
--     end that RAISES if the result is not exactly right, and because the
--     editor wraps the whole script in a single transaction, that raise rolls
--     back every change automatically. So it either lands perfectly or it
--     does nothing at all. There is no half-applied state to recover from.
-- ============================================================================


-- ############################################################################
-- SECTION A — PREVIEW. Read-only. Run this on its own first.
-- Select from here down to the "SECTION B" banner, and press Run.
-- ############################################################################

-- A1. The pairs, with how much work sits on each side.
--
-- Look at new_subtasks / new_subtasks_done / new_attachments. If they are all
-- 0, the 21 Nov copies are untouched and Section B is safe. If ANY row shows
-- work on the new copy, stop and send me that row.
with target as (
  -- Scope to the one master task that changed. Everything below is confined
  -- to its assignments, so no other task type can be touched.
  select a.id as assignment_id
  from ca_client_assignments a
  where a.master_task_id = '0f6e043e-f3a9-4b97-9786-ba4e491ed8ce'
),
tasks_for_target as (
  select
    t.id, t.client_id, t.due_date, t.created_at,
    (t.custom_fields ->> '_assignment_id')::uuid as assignment_id
  from tasks t
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and (t.custom_fields ->> '_assignment_id')::uuid in (select assignment_id from target)
),
old_t as (select * from tasks_for_target where due_date = '2026-10-31'),
new_t as (select * from tasks_for_target where due_date = '2026-11-21')
select
  c.name                                                                              as client,
  o.id                                                                                as keep_task_id,
  (select count(*) from tasks s where s.parent_task_id = o.id)                        as keep_subtasks,
  (select count(*) from tasks s where s.parent_task_id = o.id and s.status = 'completed') as keep_subtasks_done,
  (select count(*) from task_attachments ta where ta.task_id = o.id)                  as keep_attachments,
  n.id                                                                                as archive_task_id,
  (select count(*) from tasks s where s.parent_task_id = n.id)                        as new_subtasks,
  (select count(*) from tasks s where s.parent_task_id = n.id and s.status = 'completed') as new_subtasks_done,
  (select count(*) from task_attachments ta where ta.task_id = n.id)                  as new_attachments
from old_t o
join new_t n on n.assignment_id = o.assignment_id
left join clients c on c.id = o.client_id
order by c.name;


-- A2. Headline counts. (This is the query that was broken in v1 — it had no
--     FROM clause. Fixed below.)
with target as (
  select a.id as assignment_id
  from ca_client_assignments a
  where a.master_task_id = '0f6e043e-f3a9-4b97-9786-ba4e491ed8ce'
),
tasks_for_target as (
  select t.id, t.due_date
  from tasks t
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and (t.custom_fields ->> '_assignment_id')::uuid in (select assignment_id from target)
)
select
  count(*) filter (where due_date = '2026-10-31') as will_move_to_21_nov,
  count(*) filter (where due_date = '2026-11-21') as duplicates_to_archive
from tasks_for_target;                            -- <-- the missing line in v1


-- ############################################################################
-- SECTION B — THE FIX.
--
-- Select from the line below down to the END OF FILE, and press Run ONCE.
-- Do not add BEGIN or COMMIT. Do not run it in pieces.
--
-- If the final check does not find exactly the right result, it raises an
-- error and the editor rolls back everything in this script. Nothing is left
-- half-done. A raised error here is a SAFE outcome, not a broken database.
-- ############################################################################

-- B0. Resolve both sides once, so every statement below works on the same rows.
create temporary table _itr_fix as
with target as (
  select a.id as assignment_id
  from ca_client_assignments a
  where a.master_task_id = '0f6e043e-f3a9-4b97-9786-ba4e491ed8ce'
),
tasks_for_target as (
  select
    t.id, t.due_date,
    (t.custom_fields ->> '_assignment_id')::uuid as assignment_id
  from tasks t
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and (t.custom_fields ->> '_assignment_id')::uuid in (select assignment_id from target)
)
select
  coalesce(o.assignment_id, n.assignment_id) as assignment_id,
  o.id as keep_id,
  n.id as archive_id
from      (select * from tasks_for_target where due_date = '2026-10-31') o
full join (select * from tasks_for_target where due_date = '2026-11-21') n
       on n.assignment_id = o.assignment_id;


-- B1. Archive the duplicate's subtasks, then the duplicate itself.
--     Archived, never deleted — these are live statutory records.
update tasks set is_archived = true, updated_at = now()
where parent_task_id in (select archive_id from _itr_fix where archive_id is not null);

update tasks set is_archived = true, updated_at = now()
where id in (select archive_id from _itr_fix where archive_id is not null);


-- B2. Remove the duplicate's spawn record.
--     MUST come before B3: ca_task_instances carries
--     UNIQUE (assignment_id, due_date), so moving the surviving instance onto
--     21 Nov while the duplicate's 21 Nov instance still exists would collide.
delete from ca_task_instances
where task_id in (select archive_id from _itr_fix where archive_id is not null);


-- B3. Move the task staff have actually been working on, and its open subtasks.
update tasks set due_date = '2026-11-21', updated_at = now()
where id in (select keep_id from _itr_fix where keep_id is not null);

update tasks set due_date = '2026-11-21', updated_at = now()
where parent_task_id in (select keep_id from _itr_fix where keep_id is not null)
  and due_date = '2026-10-31'
  and status <> 'completed';


-- B4. Point the surviving spawn record at the new date and month, so tonight's
--     cron recognises 21 Nov as already spawned and does not duplicate again.
update ca_task_instances
set due_date = '2026-11-21', month_key = 'nov'
where task_id in (select keep_id from _itr_fix where keep_id is not null);


-- B5. SAFETY CHECK. Raises -> whole script rolls back.
do $$
declare
  leftover_oct   int;
  out_of_sync    int;
  still_dupes    int;
  moved          int;
begin
  select count(*) into leftover_oct
  from tasks t
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and t.due_date = '2026-10-31';

  select count(*) into out_of_sync
  from tasks t
  join ca_task_instances i on i.task_id = t.id
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and i.due_date is distinct from t.due_date;

  select count(*) into still_dupes
  from (
    select (t.custom_fields ->> '_assignment_id')::uuid as a
    from tasks t
    where t.title = 'ITR (with Audit)'
      and t.parent_task_id is null
      and t.custom_fields @> '{"_ca_compliance": true}'
      and coalesce(t.is_archived, false) = false
      and t.status <> 'completed'
    group by 1
    having count(*) > 1
  ) d;

  select count(*) into moved from _itr_fix where keep_id is not null;

  if leftover_oct > 0 then
    raise exception 'ROLLED BACK: % task(s) still sit on 2026-10-31', leftover_oct;
  end if;
  if out_of_sync > 0 then
    raise exception 'ROLLED BACK: % task(s) disagree with their spawn record', out_of_sync;
  end if;
  if still_dupes > 0 then
    raise exception 'ROLLED BACK: % client(s) still hold two open tasks', still_dupes;
  end if;

  raise notice 'OK — % task(s) moved to 2026-11-21, duplicates archived, spawn records in sync.', moved;
end $$;


-- B6. What you should see afterwards: one row, 2026-11-21, all in sync.
select
  t.due_date,
  count(*)                                                       as open_tasks,
  count(*) filter (where i.due_date = t.due_date)                as in_sync
from tasks t
left join ca_task_instances i on i.task_id = t.id
where t.title = 'ITR (with Audit)'
  and t.parent_task_id is null
  and t.custom_fields @> '{"_ca_compliance": true}'
  and coalesce(t.is_archived, false) = false
  and t.status <> 'completed'
group by t.due_date
order by t.due_date;

drop table if exists _itr_fix;
