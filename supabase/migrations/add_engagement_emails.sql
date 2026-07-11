-- Engagement email engine: weekly educational/promotional emails with a
-- per-user send log so the same template is never sent twice to one user.

CREATE TABLE IF NOT EXISTS marketing_email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  template_id text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);
CREATE INDEX IF NOT EXISTS idx_marketing_log_user ON marketing_email_log(user_id);

-- Marketing consent flag (unsubscribe link in every engagement email sets this)
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_out boolean NOT NULL DEFAULT false;
