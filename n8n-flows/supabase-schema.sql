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
-- MIGRATIONS: columns added for n8n flows 01 + 02
-- Run these if the table already exists
-- ============================================================
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS linkedin_content    text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS instagram_caption   text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS carousel_slides     jsonb;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS youtube_script      text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS topic_angle         text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS image_prompt        text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS carousel_image_urls jsonb;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS youtube_video_url   text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS youtube_video_id    text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS yt_views            int DEFAULT 0;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS yt_likes            int DEFAULT 0;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS yt_comments         int DEFAULT 0;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS whatsapp_sent       boolean DEFAULT false;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS whatsapp_content    text;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS li_reactions        int DEFAULT 0;
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS ig_saves            int DEFAULT 0;

-- Extend status constraint to include pending_review
ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_status_check;
ALTER TABLE content_queue ADD CONSTRAINT content_queue_status_check
  CHECK (status IN ('pending','pending_review','approved','scheduled','published','rejected'));

-- ============================================================
-- COMMUNITY OPERATIONS — Tables for n8n flow 03
-- ============================================================

-- Newsletter drafts and send history
CREATE TABLE IF NOT EXISTS newsletter_queue (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_of     date NOT NULL,
  subject     text NOT NULL,
  html_body   text NOT NULL,
  status      text DEFAULT 'pending_review'
              CHECK (status IN ('pending_review','sent','cancelled')),
  sent_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE newsletter_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON newsletter_queue FOR ALL USING (true);

-- Newsletter subscribers list
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text UNIQUE NOT NULL,
  name        text,
  status      text DEFAULT 'active' CHECK (status IN ('active','unsubscribed')),
  source      text,  -- 'community_join' | 'planora_signup' | 'manual'
  subscribed_at timestamptz DEFAULT now()
);
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON newsletter_subscribers FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_nl_subs_status ON newsletter_subscribers(status);

-- Community members (WhatsApp + Discord + Pro paid)
CREATE TABLE IF NOT EXISTS community_members (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text,
  email           text,
  phone           text,                      -- E.164 format: +91XXXXXXXXXX
  tier            text DEFAULT 'free'
                  CHECK (tier IN ('free','pro','cohort','enterprise')),
  last_active_at  timestamptz,
  whatsapp_replies int DEFAULT 0,
  joined_at       timestamptz DEFAULT now()
);
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON community_members FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_community_tier ON community_members(tier);
CREATE INDEX IF NOT EXISTS idx_community_joined ON community_members(joined_at);

-- ============================================================
-- TEST: insert a dummy row to verify everything works
-- ============================================================
-- INSERT INTO content_queue (idea_title, linkedin_content, status)
-- VALUES ('Test Post', 'This is a test LinkedIn post.', 'pending_review');
-- SELECT * FROM content_queue;
