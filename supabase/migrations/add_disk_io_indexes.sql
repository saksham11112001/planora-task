-- ============================================================================
-- Additional indexes to reduce Disk IO.
-- Targets:
--   1. JSONB containment queries on tasks.custom_fields (_ca_compliance, _blocked_by)
--   2. notification_preferences batch lookups after N+1 elimination
--   3. recurringSpawn cross-org recurring task scan
--   4. tasks.parent_recurring_id idempotency check in recurringSpawn
-- Run with CREATE INDEX CONCURRENTLY on a live DB to avoid locking.
-- ============================================================================

-- GIN index on tasks.custom_fields — makes .contains() queries use an index
-- instead of a sequential scan.  Required for _ca_compliance and _blocked_by filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_custom_fields_gin
  ON tasks USING GIN (custom_fields);

-- Partial index for recurring-spawn cron: daily scan for due recurring templates.
-- WHERE is_recurring=true AND next_occurrence_date <= today AND is_archived=false
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_recurring_due
  ON tasks(next_occurrence_date)
  WHERE is_recurring = true AND is_archived = false;

-- Idempotency check in recurringSpawn: WHERE parent_recurring_id=X AND due_date=Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_parent_recurring_due
  ON tasks(parent_recurring_id, due_date)
  WHERE parent_recurring_id IS NOT NULL;

-- notification_preferences: batch IN lookup after N+1 elimination.
-- Old pattern: WHERE user_id=X AND event_type=Y (one query per user, per task)
-- New pattern: WHERE user_id IN (...) AND event_type=Y (one query for all users)
-- Both benefit from this composite index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_prefs_event_user
  ON notification_preferences(event_type, user_id);
