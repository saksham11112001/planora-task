-- Index the two queries the digest job actually runs.
--
-- The only index on this table is (org_id, sent_at) WHERE sent_at IS NULL, and
-- the digest is platform-wide: it never filters by org. Both of its queries are
--
--   ... WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT n     -- the read
--   ... WHERE sent_at IS NULL AND created_at < cutoff             -- the cleanup
--
-- so Postgres had to read every pending row and sort it, on every run, twice a
-- day. That is fine on an empty queue and very much not fine on the backlog
-- that built up while sends were failing — the 6 PM run took 9m24s and the site
-- returned 504 on every route until the database was restarted.
--
-- Partial, so it only covers rows that are still pending. Those are the only
-- rows either query looks at, and the index stays small as sent rows pile up.
--
-- Safe to re-run. CONCURRENTLY so it does not lock the table; note that means
-- it cannot run inside a transaction block — paste it on its own in the SQL
-- editor rather than wrapping it with anything else.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_queue_pending_created
  ON notification_queue(created_at)
  WHERE sent_at IS NULL;
