-- ============================================================================
-- FIX: tasks.frequency CHECK constraint too narrow (BUG-11)
--
-- PROBLEM: The original CHECK only allowed the 6 basic frequencies:
--   ('daily','weekly','bi_weekly','monthly','quarterly','annual')
--
-- The application code (recurringSpawn, import route, UI) supports extended
-- frequency formats:
--   weekly_mon / weekly_tue / weekly_wed / weekly_thu / weekly_fri
--   bi_weekly
--   monthly_last / quarterly_last
--   every_N_days  (e.g. every_3_days, every_10_days)
--   monthly_N     (e.g. monthly_15 — spawn on the 15th each month)
--   quarterly_N   (e.g. quarterly_1)
--   annual_Nmon   (e.g. annual_31mar)
--
-- Any task created with an extended frequency (e.g. "monthly_15") would hit a
-- CHECK violation and return a 500 error, silently breaking the feature.
--
-- FIX: Drop the strict enum CHECK and replace with a regex pattern that accepts
-- all documented formats. A NULL frequency remains valid (non-recurring tasks).
-- ============================================================================

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_frequency_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_frequency_check
  CHECK (
    frequency IS NULL
    OR frequency ~ '^(daily|weekly|bi_weekly|monthly|quarterly|annual|monthly_last|quarterly_last|weekly_(mon|tue|wed|thu|fri)|every_\d+_days|monthly_\d+|quarterly_\d+|annual_\d+[a-z]+)$'
  );
