-- ============================================================================
-- Why are repeat tasks sitting in Monitor with an overdue date?
--
-- READ ONLY. Nothing is changed. Run the whole file and send me all five
-- result sets.
--
-- There are two very different explanations and they need separating before
-- anything is touched:
--
--   A. DISPLAY ONLY. Monitor labels a row "Repeat" when is_recurring = true,
--      and renders tasks.due_date. For a recurring TEMPLATE that column is
--      the first occurrence's date and never moves — so a perfectly healthy
--      monthly template shows a date from May 2026 forever, while its real
--      next run sits in next_occurrence_date. Nothing is broken; the list is
--      showing the recipe next to the meals.
--
--   B. GENUINELY STUCK. The daily job selects templates with
--        .neq('is_archived', true)
--      In SQL `is_archived <> true` is NULL for rows where is_archived IS
--      NULL, and NULL is not TRUE — so those rows are filtered OUT. A
--      template with is_archived IS NULL is invisible to the job and will
--      never spawn anything, ever.
--
-- Query 2 is the one that decides.
-- ============================================================================


-- ── 1. Does the NULL trap have anything to bite? ────────────────────────────
-- If null_rows is 0 everywhere, explanation B is impossible and this is
-- purely a display question.
select
  count(*)                                              as all_tasks,
  count(*) filter (where is_archived is null)           as null_is_archived,
  count(*) filter (where is_archived = false)           as false_is_archived,
  count(*) filter (where is_archived = true)            as true_is_archived
from tasks;


-- ── 2. THE DECIDING QUERY ───────────────────────────────────────────────────
-- Every recurring template, with what the job would see and what it has
-- actually produced.
--
--   verdict = 'INVISIBLE TO JOB'  -> explanation B. is_archived IS NULL, so
--                                   the daily job never even selects it.
--   verdict = 'OVERDUE TO SPAWN'  -> the job can see it and its next run is
--                                   in the past: a real failure to spawn.
--   verdict = 'healthy'           -> next run is in the future. Its Monitor
--                                   row is explanation A and nothing more.
select
  t.title,
  t.is_archived,
  t.due_date                      as monitor_shows_this,
  t.next_occurrence_date          as actual_next_run,
  t.frequency,
  (select count(*) from tasks o where o.parent_recurring_id = t.id)      as occurrences_created,
  (select max(o.due_date) from tasks o where o.parent_recurring_id = t.id) as latest_occurrence,
  case
    when t.is_archived is null                                   then 'INVISIBLE TO JOB'
    when t.next_occurrence_date is null                          then 'NO NEXT DATE SET'
    when t.next_occurrence_date <= current_date                   then 'OVERDUE TO SPAWN'
    else                                                              'healthy'
  end                             as verdict
from tasks t
where t.is_recurring = true
  and t.parent_recurring_id is null
  and coalesce(t.is_archived, false) = false
order by verdict, t.next_occurrence_date nulls first, t.title;


-- ── 3. The same thing as one line ───────────────────────────────────────────
select
  count(*)                                                                as templates,
  count(*) filter (where is_archived is null)                             as invisible_to_job,
  count(*) filter (where is_archived is not null
                     and next_occurrence_date is null)                    as no_next_date,
  count(*) filter (where is_archived is not null
                     and next_occurrence_date <= current_date)            as overdue_to_spawn,
  count(*) filter (where is_archived is not null
                     and next_occurrence_date > current_date)             as healthy
from tasks
where is_recurring = true
  and parent_recurring_id is null
  and coalesce(is_archived, false) = false;


-- ── 4. Has the daily job produced anything at all lately? ───────────────────
-- Occurrences carry parent_recurring_id. If the most recent one is weeks old
-- while query 3 shows templates due, the job itself is not completing.
select
  date_trunc('week', created_at)::date as week,
  count(*)                             as occurrences_spawned
from tasks
where parent_recurring_id is not null
  and created_at > current_date - interval '120 days'
group by 1
order by 1 desc;


-- ── 5. The exact rows from the screenshot ───────────────────────────────────
-- Named directly so there is no doubt we are looking at the same records.
select
  t.title,
  t.is_archived,
  t.due_date             as monitor_shows_this,
  t.next_occurrence_date as actual_next_run,
  t.frequency,
  (select count(*) from tasks o where o.parent_recurring_id = t.id) as occurrences_created
from tasks t
where t.is_recurring = true
  and t.parent_recurring_id is null
  and t.title in (
    'Check Negative Debtors / Old Debtors/ Un Applied Payments',
    'SGNG MIS',
    'Check Loan to individual (inter company loan)',
    'WDRA -Accounting',
    'SGNG- IA',
    'Salary Payment',
    'SGNG Monthly MIS Report'
  )
order by t.title;
