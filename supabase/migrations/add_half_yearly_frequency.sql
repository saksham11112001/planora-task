-- Add half_yearly to the tasks.frequency CHECK constraint.
-- half_yearly = every 6 months (handled by nextOccurrence in recurringSchedule.ts).

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_frequency_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_frequency_check
  CHECK (
    frequency IS NULL
    OR frequency ~ '^(daily|weekly|bi_weekly|monthly|quarterly|half_yearly|annual|monthly_last|quarterly_last|weekly_(mon|tue|wed|thu|fri)|every_\d+_days|monthly_\d+|quarterly_\d+|annual_\d+[a-z]+)$'
  );
