-- ============================================================
-- AI Community Content Pipeline — Supabase Schema
-- Run this in your Supabase SQL Editor before importing n8n flows
-- ============================================================

-- Content Queue: stores all drafted + scheduled + published posts
CREATE TABLE IF NOT EXISTS content_queue (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  idea_title      text NOT NULL,
  topic_source    text,                          -- which RSS feed the idea came from
  linkedin_draft  text,                          -- full LinkedIn post text
  instagram_draft text,                          -- Instagram caption + hashtags
  whatsapp_draft  text,                          -- WhatsApp community message
  image_url       text,                          -- R2 or external image URL
  image_prompt    text,                          -- prompt used to generate image
  status          text DEFAULT 'pending'         -- pending | approved | scheduled | published | rejected
                  CHECK (status IN ('pending','approved','scheduled','published','rejected')),
  scheduled_at    timestamptz,                   -- when to publish (IST optimal time)
  published_at    timestamptz,                   -- actual publish timestamp
  week_of         date DEFAULT CURRENT_DATE,     -- week this was generated for

  -- Platform post IDs (stored after publishing for analytics pull)
  linkedin_post_id   text,
  instagram_post_id  text,

  -- LinkedIn analytics (populated 48h after publish)
  li_likes        int DEFAULT 0,
  li_comments     int DEFAULT 0,
  li_shares       int DEFAULT 0,
  li_impressions  int DEFAULT 0,
  li_clicks       int DEFAULT 0,

  -- Instagram analytics
  ig_likes        int DEFAULT 0,
  ig_comments     int DEFAULT 0,
  ig_reach        int DEFAULT 0,
  ig_saves        int DEFAULT 0,

  -- Scoring
  performance_score  float DEFAULT 0,           -- 0-100 computed engagement score
  score_notes        text,                       -- Claude's analysis of what worked

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Idea scoring weights: Claude updates these weekly based on what performed
CREATE TABLE IF NOT EXISTS content_scoring (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_of        date NOT NULL,
  top_topics     text[],                         -- topics that scored highest this week
  top_formats    text[],                         -- post formats that worked best
  best_hook_patterns text[],                     -- opening line patterns with high engagement
  avoid_topics   text[],                         -- topics that underperformed
  avg_score      float DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- Notification log: tracks approval emails sent
CREATE TABLE IF NOT EXISTS content_notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_date  date NOT NULL,
  post_count  int NOT NULL,
  sent_at     timestamptz DEFAULT now(),
  email_id    text                               -- Resend email ID for tracking
);

-- RLS: only authenticated users (your service role) can access
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_scoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypass (n8n uses service_role key so this is fine)
CREATE POLICY "service_role_all" ON content_queue FOR ALL USING (true);
CREATE POLICY "service_role_all" ON content_scoring FOR ALL USING (true);
CREATE POLICY "service_role_all" ON content_notifications FOR ALL USING (true);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_week ON content_queue(week_of);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled ON content_queue(scheduled_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_queue_updated_at
  BEFORE UPDATE ON content_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TEST: insert a dummy row to verify everything works
-- ============================================================
-- INSERT INTO content_queue (idea_title, linkedin_draft, status)
-- VALUES ('Test Post', 'This is a test LinkedIn post.', 'pending');
-- SELECT * FROM content_queue;
