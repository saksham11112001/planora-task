-- Migrate all in_progress tasks to todo across all organisations
UPDATE tasks
SET status = 'todo'
WHERE status = 'in_progress';
