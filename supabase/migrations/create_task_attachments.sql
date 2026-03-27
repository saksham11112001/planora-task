-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS task_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_org  ON task_attachments(org_id);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_read"   ON task_attachments;
DROP POLICY IF EXISTS "attachments_insert" ON task_attachments;
DROP POLICY IF EXISTS "attachments_delete" ON task_attachments;

CREATE POLICY "attachments_read"   ON task_attachments FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "attachments_insert" ON task_attachments FOR INSERT WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "attachments_delete" ON task_attachments FOR DELETE USING (org_id = public.user_org_id() AND (uploaded_by = auth.uid() OR public.user_org_role() IN ('owner','admin','manager')));

-- Also create Supabase storage bucket for task attachments (run separately in dashboard)
-- Storage > Buckets > New bucket: "task-attachments" (private)
