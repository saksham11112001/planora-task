-- Prevents more than 1 email per user per day
-- Each row = "this user has been emailed today"
-- Auto-cleared: rows with date < today are ignored (use date comparison, no cron needed)

CREATE TABLE IF NOT EXISTS email_daily_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  email_type TEXT NOT NULL DEFAULT 'any',
  UNIQUE(user_id, sent_date)
);

CREATE INDEX IF NOT EXISTS idx_email_daily_log_user_date ON email_daily_log(user_id, sent_date);

-- No RLS needed - only accessed by service role in Inngest functions
