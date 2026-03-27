-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS org_feature_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  config      JSONB,
  UNIQUE(org_id, feature_key)
);

ALTER TABLE org_feature_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "features_read"   ON org_feature_settings;
DROP POLICY IF EXISTS "features_manage" ON org_feature_settings;
DROP POLICY IF EXISTS "features_insert" ON org_feature_settings;

CREATE POLICY "features_read"   ON org_feature_settings FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "features_manage" ON org_feature_settings FOR ALL    USING (org_id = public.user_org_id());
CREATE POLICY "features_insert" ON org_feature_settings FOR INSERT WITH CHECK (true);
