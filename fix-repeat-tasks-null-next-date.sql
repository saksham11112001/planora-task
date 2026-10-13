-- ============================================================================
-- Repeat tasks that never spawn
--
-- Your diagnostic returned:
--     131 templates — 0 invisible, 8 with NO next date, 8 overdue, 115 healthy
--
-- The 115 are fine. Their Monitor rows show a stale due_date, which is a
-- display quirk, not a fault — see the note at the bottom.
--
-- This file deals with the 8 that have next_occurrence_date = NULL.
--
-- WHY THEY NEVER RUN
-- The daily job selects templates with  next_occurrence_date <= today.
-- In SQL, NULL <= today evaluates to NULL, not TRUE, so those rows are never
-- selected. The template looks completely normal in the UI and has never
-- produced a single occurrence — three of them are the ones you flagged:
-- SGNG Monthly MIS Report, SGNG- IA and WDRA -Accounting, all with 0
-- occurrences created.
--
-- The code fix stops new ones being created this way. This repairs the
-- existing rows.
-- ============================================================================


-- ############################################################################
-- SECTION A — LOOK FIRST. Read-only.
-- ############################################################################

-- A1. The 8 dead templates, and what Section B would set them to.
--
-- Setting the next run to TODAY rather than to their old due_date is
-- deliberate: a stale due_date would make the job spawn a back-dated task,
-- then crawl forward one cycle per nightly run to catch up. Starting today
-- gives one occurrence tomorrow morning and a correct cadence from then on.
select
  id,
  title,
  frequency,
  due_date                      as stale_due_date_shown_in_monitor,
  next_occurrence_date          as current_value,
  current_date                  as would_be_set_to,
  (select count(*) from tasks o where o.parent_recurring_id = t.id) as occurrences_so_far
from tasks t
where t.is_recurring = true
  and t.parent_recurring_id is null
  and coalesce(t.is_archived, false) = false
  and t.next_occurrence_date is null
order by t.title;


-- A2. The OTHER 8 — overdue but visible to the job.
--
-- These are a different problem and Section B does NOT touch them. Your
-- earlier result set was capped at 100 rows so they were cut off. Send me
-- this output and I will work out why they are not advancing.
select
  t.id,
  t.title,
  t.frequency,
  t.custom_fields ->> '_granular_frequency' as granular_frequency,
  t.next_occurrence_date,
  current_date - t.next_occurrence_date     as days_overdue,
  (select count(*) from tasks o where o.parent_recurring_id = t.id)        as occurrences_so_far,
  (select max(o.due_date) from tasks o where o.parent_recurring_id = t.id) as latest_occurrence
from tasks t
where t.is_recurring = true
  and t.parent_recurring_id is null
  and coalesce(t.is_archived, false) = false
  and t.next_occurrence_date is not null
  and t.next_occurrence_date <= current_date
order by t.next_occurrence_date;


-- ############################################################################
-- SECTION B — THE REPAIR.
--
-- Select from the line below to the end and Run ONCE. One statement.
-- It only touches templates whose next_occurrence_date IS NULL, so it cannot
-- affect the 115 healthy ones or the 8 overdue ones.
--
-- Safe to re-run: after it succeeds no rows match the WHERE clause any more.
-- ############################################################################

update tasks
set next_occurrence_date = current_date,
    updated_at           = now()
where is_recurring = true
  and parent_recurring_id is null
  and coalesce(is_archived, false) = false
  and next_occurrence_date is null
returning id, title, frequency, next_occurrence_date;

-- Expect 8 rows back, including SGNG Monthly MIS Report, SGNG- IA and
-- WDRA -Accounting.
--
-- They will produce their first occurrence on the next nightly run (1:30 UTC
-- / 7:00 IST) and follow their normal cadence afterwards. Nothing is
-- back-dated and no flood of catch-up tasks is created.


-- ============================================================================
-- ABOUT THE 115 "overdue" ROWS IN MONITOR — nothing to fix in the data
--
-- Monitor labels a row "Repeat" when is_recurring = true and renders
-- tasks.due_date. On a TEMPLATE that column holds the first occurrence's date
-- and never advances; the live schedule is next_occurrence_date. So a healthy
-- monthly template created in May shows "May 30, 2026" forever while quietly
-- spawning on time every month.
--
-- Your examples, all healthy:
--   Check Negative Debtors   Monitor 2026-05-30  actual next run 2026-10-30
--   SGNG MIS                 Monitor 2026-06-01  actual next run 2026-11-01
--   Check Loan to individual Monitor 2026-06-01  actual next run 2026-10-30
--   Salary Payment           Monitor 2026-10-01  actual next run 2026-11-02
--
-- That is a UI decision to make, not a data repair: either hide templates
-- from Monitor, or show next_occurrence_date for them. Both change counts
-- people read, so it is worth choosing deliberately.
-- ============================================================================
