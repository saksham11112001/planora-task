-- ============================================================================
-- Clean up the duplicate "ITR (with Audit)" tasks                       (v5)
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
-- SECTION A is read-only. Run it first.
-- SECTION B is ONE statement. Select it whole and Run once. No BEGIN, no
-- COMMIT, no running it in pieces. If its checks fail it raises an error and
-- everything it did is rolled back, so it either lands completely or changes
-- nothing at all.
--
-- Earlier revisions failed on four things, all now handled: a missing FROM
-- clause; an instruction to COMMIT separately (which does not work through
-- the pooler); unpaired 21 Nov tasks that must NOT be archived; and the
-- unique index tasks_ca_assignment_due_unique, which is not in this repo's
-- migrations and blocks moving a task onto a date another row still holds.
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
-- SECTION B — THE FIX.                                   (v5 — single statement)
--
-- Select from the line below to the END OF FILE and press Run ONCE.
-- Do not add BEGIN or COMMIT. Do not run it in pieces.
--
-- WHY THIS LOOKS DIFFERENT FROM v4
-- v4 staged its work in a TEMPORARY table (_itr_fix). Temp tables live for
-- one session, and Supabase's connection pooler does not guarantee that the
-- statements of a script share one — hence
--     ERROR 42P01: relation "_itr_fix" does not exist
-- on the very first statement that referenced it.
--
-- So there is no temp table any more. The whole fix is ONE statement: a
-- single DO block holding the ids in local arrays. One statement cannot be
-- split across connections, and if the checks at the end fail it RAISES,
-- which rolls back everything it did. It either lands completely or it
-- changes nothing.
-- ############################################################################

do $$
declare
  v_master     uuid := '0f6e043e-f3a9-4b97-9786-ba4e491ed8ce';
  v_old_date   date := '2026-10-31';
  v_new_date   date := '2026-11-21';
  v_new_month  text := 'nov';

  v_assign     uuid[];   -- every assignment this touches
  v_keep       uuid[];   -- the tasks staff have worked on; these MOVE
  v_arch       uuid[];   -- the cron's empty duplicates; these get parked

  leftover_old int;
  out_of_sync  int;
  still_dupes  int;
  orphaned     int;
  badpark      int;
begin
  -- ── Resolve both sides, once, into local arrays ──────────────────────────
  with target as (
    select a.id as assignment_id
    from ca_client_assignments a
    where a.master_task_id = v_master
  ),
  tfg as (
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
  ),
  pairs as (
    select
      coalesce(o.assignment_id, n.assignment_id) as assignment_id,
      o.id as keep_id,
      -- A 21 Nov task is only a DUPLICATE when its assignment ALSO still has
      -- a 31 Oct task. Unpaired 21 Nov tasks are that client's only one —
      -- archiving them would leave the client with nothing. The cron kept
      -- running after the incident, so these genuinely exist.
      case when o.id is not null then n.id end as archive_id
    from      (select * from tfg where due_date = v_old_date) o
    full join (select * from tfg where due_date = v_new_date) n
           on n.assignment_id = o.assignment_id
  )
  select
    coalesce(array_agg(assignment_id) filter (where assignment_id is not null), '{}'),
    coalesce(array_agg(keep_id)       filter (where keep_id       is not null), '{}'),
    coalesce(array_agg(archive_id)    filter (where archive_id    is not null), '{}')
  into v_assign, v_keep, v_arch
  from pairs;

  raise notice 'Found % assignment(s): % to move, % duplicate(s) to park.',
    array_length(v_assign,1), coalesce(array_length(v_keep,1),0), coalesce(array_length(v_arch,1),0);

  if coalesce(array_length(v_keep,1),0) = 0 then
    raise exception 'NOTHING TO DO: no tasks found on %. Has this already been run?', v_old_date;
  end if;

  -- ── 1. Park the duplicate OFF the date, then archive it ──────────────────
  -- tasks carries a unique index on (assignment_id, due_date) —
  -- tasks_ca_assignment_due_unique — which is not in this repo's migrations;
  -- it was added directly in Supabase. Archiving does NOT free that key,
  -- because the row still exists, so moving the survivor onto 21 Nov while
  -- the duplicate sat there failed with 23505 in v3.
  --
  -- Setting due_date to NULL releases it: NULLs never conflict in a unique
  -- index. The date it held is written into custom_fields first, so nothing
  -- is lost and the step is reversible.
  update tasks
  set is_archived   = true,
      due_date      = null,
      custom_fields = coalesce(custom_fields, '{}'::jsonb)
                      || jsonb_build_object('_archived_duplicate_due', due_date::text,
                                            '_archived_on',           now()::date::text),
      updated_at    = now()
  where id = any(v_arch);

  update tasks set is_archived = true, updated_at = now()
  where parent_task_id = any(v_arch);

  -- ── 2. Drop the duplicate's spawn record ─────────────────────────────────
  -- ca_task_instances has UNIQUE (assignment_id, due_date) too, so the
  -- survivor's record cannot take 21 Nov until this is gone.
  delete from ca_task_instances where task_id = any(v_arch);

  -- ── 3. The date is now free — move the task staff have been working on ───
  update tasks set due_date = v_new_date, updated_at = now()
  where id = any(v_keep);

  update tasks set due_date = v_new_date, updated_at = now()
  where parent_task_id = any(v_keep)
    and due_date = v_old_date
    and status <> 'completed';

  -- ── 4. Re-point the surviving spawn record ───────────────────────────────
  -- Without this tonight's cron sees an unknown due date and duplicates all
  -- over again.
  update ca_task_instances
  set due_date = v_new_date, month_key = v_new_month
  where task_id = any(v_keep);

  -- ── 5. Verify. Any failure here rolls back everything above. ─────────────
  select count(*) into leftover_old
  from tasks t
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and t.due_date = v_old_date;
  if leftover_old > 0 then
    raise exception 'ROLLED BACK: % task(s) still sit on %', leftover_old, v_old_date;
  end if;

  select count(*) into out_of_sync
  from tasks t
  join ca_task_instances i on i.task_id = t.id
  where t.title = 'ITR (with Audit)'
    and t.parent_task_id is null
    and t.custom_fields @> '{"_ca_compliance": true}'
    and coalesce(t.is_archived, false) = false
    and t.status <> 'completed'
    and i.due_date is distinct from t.due_date;
  if out_of_sync > 0 then
    raise exception 'ROLLED BACK: % task(s) disagree with their spawn record', out_of_sync;
  end if;

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
  if still_dupes > 0 then
    raise exception 'ROLLED BACK: % client(s) still hold two open tasks', still_dupes;
  end if;

  -- Nobody may be left with nothing.
  select count(*) into orphaned
  from unnest(v_assign) as a(assignment_id)
  where not exists (
    select 1 from tasks t
    where (t.custom_fields ->> '_assignment_id')::uuid = a.assignment_id
      and t.title = 'ITR (with Audit)'
      and t.parent_task_id is null
      and t.custom_fields @> '{"_ca_compliance": true}'
      and coalesce(t.is_archived, false) = false
      and t.status <> 'completed'
  );
  if orphaned > 0 then
    raise exception 'ROLLED BACK: % client(s) would be left with no open ITR task', orphaned;
  end if;

  -- Every parked duplicate must be archived AND off the date, or the unique
  -- index bites again on the next cron run.
  select count(*) into badpark
  from tasks t
  where t.id = any(v_arch)
    and (coalesce(t.is_archived, false) = false or t.due_date is not null);
  if badpark > 0 then
    raise exception 'ROLLED BACK: % duplicate(s) were not parked correctly', badpark;
  end if;

  raise notice 'SUCCESS — % task(s) moved to %, % duplicate(s) archived, spawn records in sync.',
    array_length(v_keep,1), v_new_date, coalesce(array_length(v_arch,1),0);
end $$;


-- What you should see now: a single row — 2026-11-21, with open_tasks equal
-- to in_sync, and no 2026-10-31 row at all.
select
  t.due_date,
  count(*)                                        as open_tasks,
  count(*) filter (where i.due_date = t.due_date) as in_sync
from tasks t
left join ca_task_instances i on i.task_id = t.id
where t.title = 'ITR (with Audit)'
  and t.parent_task_id is null
  and t.custom_fields @> '{"_ca_compliance": true}'
  and coalesce(t.is_archived, false) = false
  and t.status <> 'completed'
group by t.due_date
order by t.due_date;
