-- ============================================================================
-- users.last_seen_at — the activity signal the app has never had.
--
-- WHY IT IS NEEDED
--   Nothing in the product records when a person last USED it. activity_log
--   only captures writes (task.created, task.completed, invoice.*), so someone
--   who signs in every morning to read their task list generates no rows at
--   all — judging activity from it would report the most diligent readers as
--   dormant.
--
--   lib/inngest/functions/reEngagement.ts already filters on
--   users.last_sign_in_at. That column is created by no migration and written
--   by no code: the query has been matching zero rows every day since it
--   shipped, so the 7-day re-engagement email has never been sent to anyone.
--   That function is repointed at this column in the same change.
--
-- HOW IT IS WRITTEN
--   POST /api/heartbeat, called once per session from the app shell. The route
--   only writes when the stored value is more than an hour old, so an active
--   user costs one UPDATE an hour rather than one per page view.
--
--   Deliberately NOT auth.users.last_sign_in_at: that records a token being
--   issued, not a person looking at the product. Sessions are long-lived here,
--   so someone can use the app daily for weeks without signing in again.
--
-- NULL means "never seen since this shipped" — every existing row starts NULL
-- and fills in as people return. The weekly report counts those separately
-- rather than calling them dormant, so the first week's numbers are honest.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Both the weekly report and the re-engagement job scan ranges of this column
-- across the whole table, so it needs its own index.
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
  ON users(last_seen_at);

-- VERIFY
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name = 'last_seen_at';
--
-- After a day or two of traffic, this should show people appearing:
--   SELECT count(*) FILTER (WHERE last_seen_at > now() - interval '7 days') AS seen_this_week,
--          count(*) FILTER (WHERE last_seen_at IS NULL)                     AS never_seen,
--          count(*)                                                          AS total
--   FROM users;
