-- CA Compliance Master Tasks
CREATE TABLE IF NOT EXISTS ca_master_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code               TEXT NOT NULL,
  name               TEXT NOT NULL,
  group_name         TEXT NOT NULL DEFAULT 'Other',
  task_type          TEXT,
  financial_year     TEXT NOT NULL DEFAULT '2026-27',
  dates              JSONB NOT NULL DEFAULT '{}',
  days_before_due    INTEGER NOT NULL DEFAULT 7,
  attachment_count   INTEGER NOT NULL DEFAULT 0,
  attachment_headers JSONB NOT NULL DEFAULT '[]',
  priority           TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, code, financial_year)
);
CREATE INDEX idx_ca_master_tasks_org ON ca_master_tasks(org_id);

-- CA Client Assignments (which clients have which master tasks)
CREATE TABLE IF NOT EXISTS ca_client_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  master_task_id  UUID NOT NULL REFERENCES ca_master_tasks(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  approver_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (master_task_id, client_id)
);
CREATE INDEX idx_ca_assignments_org    ON ca_client_assignments(org_id);
CREATE INDEX idx_ca_assignments_client ON ca_client_assignments(client_id);

-- CA Task Instances (tracks which task objects were created for each assignment+date)
CREATE TABLE IF NOT EXISTS ca_task_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES ca_client_assignments(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  due_date      DATE NOT NULL,
  month_key     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','created','skipped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, due_date)
);

-- Drive links support in task_attachments
ALTER TABLE task_attachments
  ADD COLUMN IF NOT EXISTS drive_url       TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT 'file';

-- RLS
ALTER TABLE ca_master_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ca_task_instances   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_ca_master"      ON ca_master_tasks      FOR ALL TO authenticated USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true LIMIT 1));
CREATE POLICY "org_ca_assignments" ON ca_client_assignments FOR ALL TO authenticated USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true LIMIT 1));
CREATE POLICY "org_ca_instances"   ON ca_task_instances    FOR ALL TO authenticated USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true LIMIT 1));

-- service_role bypass
CREATE POLICY "service_ca_master"      ON ca_master_tasks      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_ca_assignments" ON ca_client_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_ca_instances"   ON ca_task_instances    FOR ALL TO service_role USING (true) WITH CHECK (true);
