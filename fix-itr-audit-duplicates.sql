-- ============================================================================
-- Clean up the duplicate "ITR (with Audit)" tasks
--
-- What happened: the master due date moved 31 Oct 2026 -> 21 Nov 2026 on
-- 29 Sep. The existing spawned tasks were never moved with it, so on 30 Sep
-- the nightly spawner saw a due date it had no record of and created a second
-- task for every assignment. 40 clients now hold two.
--
-- The plan: KEEP the original task (it is the one staff have been working on
-- since 2 August, with its subtasks, attachments and comments) and move it to
-- 21 Nov. ARCHIVE the empty duplicate the cron created on 30 Sep.
--
-- Archive, not delete. These are live compliance tasks with statutory
-- deadlines; archiving is reversible and a mistake costs nothing.
--
-- RUN SECTION A FIRST AND READ IT. Only run Section B once A confirms the
-- 21 Nov copies really are untouched.
-- ============================================================================


-- ############################################################################
-- SECTION A — PREVIEW. Read-only. Nothing is changed.
-- ############################################################################

-- A1. The pairs, with how much work sits on each side.
--
-- Look at the `new_*` columns. If they are all 0, the 21 Nov copies are
-- untouched and Section B is safe. If ANY row shows work on the new copy,
-- stop and send me that row — it needs handling by hand.
with target as (
  -- Scope to the one master task that was changed. Everything below is
  -- confined to its assignments, so no other task type can be touched.
  select a.id as assignment_id, a.org_id, a.client_id
  from ca_client_assignments a
  where a.master_task_id = '0f6e043e-f3a9-4b97-9786-ba4e491ed8ce'
),
tasks_for_target as (
  select
    t.id, t.client_id, t.due_date, t.status, t.created_at,
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
  c.name                                        as client,
  o.id                                          as keep_task_id,
  o.created_at                                  as keep_created,
  (select count(*) from tasks s  where s.parent_task_id = o.id)                        as keep_subtasks,
  (select count(*) from tasks s  where s.parent_task_id = o.id and s.status = 'completed') as keep_subtasks_done,
  (select count(*) from task_attachments ta where ta.task_id = o.id)                   as keep_attachments,
  n.id                                          as archive_task_id,
  n.created_at                                  as archive_created,
  (select count(*) from tasks s  where s.parent_task_id = n.id)                        as new_subtasks,
  (select count(*) from tasks s  where s.parent_task_id = n.id and s.status = 'completed') as new_subtasks_done,
  (select count(*) from task_attachments ta where ta.task_id = n.id)                   as new_attachments
from old_t o
join new_t n on n.assignment_id = o.assignment_id
left join clients c on c.id = o.client_id
order by c.name;


-- A2. Headline counts — what Section B will touch.
with target as (
  select a.id as assignment_id
  from ca_client_assignments a
  where a.master_task_id = '0f6e043e-f3a9-4b97-9786-ba4e491ed8ce'
),
tasks_for_target as (
  select t.id, t.due_date, (t.custom_fields ->> '_assignment_id')::uuid as assignment_id
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
  count(*) filter (where due_date = '2026-11-21') as duplicates_to_archive;


-- ############################################################################
-- SECTION B — THE FIX. Only run after reading Section A.
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
-- The final SELECT shows the result BEFORE you commit.
-- ############################################################################

begin;

-- Resolve the two sides once, into a temp table, so every statement below
-- operates on exactly the same rows.
create temporary table _itr_fix on commit drop as
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
  o.assignment_id,
  o.id as keep_id,
  n.id as archive_id
from      (select * from tasks_for_target where due_date = '2026-10-31') o
full join (select * from tasks_for_target where due_date = '2026-11-21') n
       on n.assignment_id = o.assignment_id;


-- B1. Archive the duplicate's subtasks first, then the duplicate itself.
--     Subtasks are archived explicitly because the parent FK's delete
--     behaviour is not relied on here — nothing is deleted at all.
update tasks set is_archived = true, updated_at = now()
where parent_task_id in (select archive_id from _itr_fix where archive_id is not null);

update tasks set is_archived = true, updated_at = now()
where id in (select archive_id from _itr_fix where archive_id is not null);


-- B2. Remove the duplicate's instance row.
--     This MUST happen before B3: ca_task_instances carries
--     UNIQUE (assignment_id, due_date), so moving the old instance to
--     21 Nov while the duplicate's 21 Nov instance still exists would
--     collide and abort.
delete from ca_task_instances
where task_id in (select archive_id from _itr_fix where archive_id is not null);


-- B3. Move the task staff have actually been working on to the new date,
--     and its open subtasks with it.
update tasks set due_date = '2026-11-21', updated_at = now()
where id in (select keep_id from _itr_fix where keep_id is not null);

update tasks set due_date = '2026-11-21', updated_at = now()
where parent_task_id in (select keep_id from _itr_fix where keep_id is not null)
  and due_date = '2026-10-31'
  and status <> 'completed';


-- B4. Point the surviving instance at the new date and month, so the next
--     cron run recognises 21 Nov as already spawned and does not duplicate
--     all over again.
update ca_task_instances
set due_date = '2026-11-21', month_key = 'nov'
where task_id in (select keep_id from _itr_fix where keep_id is not null);


-- B5. Verify BEFORE committing.
--     Expect: 40 rows on 2026-11-21, 0 rows on 2026-10-31, and every row
--     'in sync'. If anything looks wrong, run ROLLBACK; instead of COMMIT;
select
  t.due_date,
  count(*)                                                     as open_tasks,
  count(*) filter (where i.due_date = t.due_date)              as in_sync,
  count(*) filter (where i.due_date is distinct from t.due_date) as out_of_sync
from tasks t
left join ca_task_instances i on i.task_id = t.id
where t.title = 'ITR (with Audit)'
  and t.parent_task_id is null
  and t.custom_fields @> '{"_ca_compliance": true}'
  and coalesce(t.is_archived, false) = false
  and t.status <> 'completed'
group by t.due_date
order by t.due_date;


-- Read B5. If it says 40 open tasks on 2026-11-21, all in sync, and no
-- 2026-10-31 row at all, then:
--
--   COMMIT;
--
-- Otherwise:
--
--   ROLLBACK;
--
-- The transaction is left OPEN deliberately. Nothing is permanent until you
-- type one of those two words.
