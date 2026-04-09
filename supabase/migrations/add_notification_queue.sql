-- Notification queue: stores pending notifications for digest mode
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS notification_queue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  user_email  TEXT NOT NULL,
  event_type  TEXT NOT NULL,   -- task_assigned | approval_requested | approval_completed | task_commented | project_updated | member_invited | due_soon | escalation
  subject     TEXT NOT NULL,   -- used as the line-item text in the digest email
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at     TIMESTAMPTZ DEFAULT NULL  -- NULL = pending; set when digest is sent
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_pending
  ON notification_queue(org_id, sent_at)
  WHERE sent_at IS NULL;

-- RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_queue_org" ON notification_queue
  FOR ALL USING (org_id = public.user_org_id());
