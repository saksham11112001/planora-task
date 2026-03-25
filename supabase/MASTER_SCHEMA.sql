-- ============================================================================
-- PLANORA V2 — MASTER DATABASE SCHEMA
-- Run this once on a fresh Supabase project.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Auto-update timestamps ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ── Auto-create user profile on signup ──────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── RLS helpers ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_org_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.user_org_role() RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.org_members
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1; $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users (mirrors auth.users)
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT,
  phone_number    TEXT,
  timezone        TEXT DEFAULT 'Asia/Kolkata',
  whatsapp_opted_in BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Organisations
CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  plan_tier       TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan_tier IN ('free','starter','pro','business')),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','trialing','past_due','cancelled')),
  trial_ends_at   TIMESTAMPTZ,
  subscription_id TEXT,          -- Razorpay subscription ID
  razorpay_customer_id TEXT,     -- Razorpay customer ID
  industry        TEXT,
  team_size       TEXT,
  logo_color      TEXT DEFAULT '#0f766e',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_orgs_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Org members
CREATE TABLE org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','manager','member','viewer')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org  ON org_members(org_id);

-- Workspaces
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#0f766e',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Clients
CREATE TABLE clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  website     TEXT,
  industry    TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','inactive','prospect')),
  color       TEXT NOT NULL DEFAULT '#0f766e',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_clients_org ON clients(org_id);

-- Projects
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT NOT NULL DEFAULT '#0f766e',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','on_hold','completed','cancelled')),
  owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date      DATE,
  due_date        DATE,
  budget          DECIMAL(12,2),
  hours_budget    DECIMAL(8,2),
  is_archived     BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_projects_org    ON projects(org_id);
CREATE INDEX idx_projects_client ON projects(client_id);

-- Tasks
CREATE TABLE tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  parent_task_id   UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'todo'
                     CHECK (status IN ('todo','in_progress','in_review','completed','cancelled')),
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('none','low','medium','high','urgent')),
  assignee_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date         DATE,
  start_date       DATE,
  completed_at     TIMESTAMPTZ,
  estimated_hours  DECIMAL(6,2),
  sort_order       INTEGER DEFAULT 0,
  -- Recurring task fields
  is_recurring         BOOLEAN NOT NULL DEFAULT false,
  frequency            TEXT CHECK (frequency IN ('daily','weekly','bi_weekly','monthly','quarterly','annual')),
  recurrence_rule      TEXT,
  recurrence_end_date  DATE,
  next_occurrence_date DATE,
  parent_recurring_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
  -- Approval
  approval_required  BOOLEAN NOT NULL DEFAULT false,
  approval_status    TEXT CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at        TIMESTAMPTZ,
  is_archived        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_tasks_org      ON tasks(org_id);
CREATE INDEX idx_tasks_project  ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_client   ON tasks(client_id);
CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_recurring ON tasks(is_recurring, next_occurrence_date);

-- Task comments
CREATE TABLE task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);

-- Task activity
CREATE TABLE task_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_activity_task ON task_activity(task_id);

-- Time logs (Worklenz-inspired time tracking)
CREATE TABLE time_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  hours       DECIMAL(5,2) NOT NULL CHECK (hours > 0),
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER t_time_logs_updated_at BEFORE UPDATE ON time_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_time_logs_org     ON time_logs(org_id);
CREATE INDEX idx_time_logs_task    ON time_logs(task_id);
CREATE INDEX idx_time_logs_user    ON time_logs(user_id);
CREATE INDEX idx_time_logs_project ON time_logs(project_id);

-- Labels
CREATE TABLE labels (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  color    TEXT NOT NULL DEFAULT '#6366f1',
  UNIQUE(org_id, name)
);

-- Task labels
CREATE TABLE task_labels (
  task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id  UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- Org permissions overrides
CREATE TABLE org_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  is_enabled     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(org_id, role, permission_key)
);

-- Org feature settings
CREATE TABLE org_feature_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  config      JSONB,
  UNIQUE(org_id, feature_key)
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  via_email    BOOLEAN NOT NULL DEFAULT true,
  via_whatsapp BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, org_id, event_type)
);

-- Audit log
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organisations(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_org ON audit_log(org_id);

-- Razorpay billing log
CREATE TABLE billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organisations(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  subscription_id TEXT,
  payment_id      TEXT,
  amount_paise    INTEGER,
  currency        TEXT DEFAULT 'INR',
  status          TEXT,
  raw_payload     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_billing_events_org ON billing_events(org_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity         ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_labels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "users_read"   ON users FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users_update" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);

-- Orgs
CREATE POLICY "orgs_read"   ON organisations FOR SELECT USING (id = public.user_org_id());
CREATE POLICY "orgs_update" ON organisations FOR UPDATE USING (id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));
CREATE POLICY "orgs_insert" ON organisations FOR INSERT WITH CHECK (true);

-- Org members
CREATE POLICY "members_read"   ON org_members FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "members_insert" ON org_members FOR INSERT WITH CHECK (true);
CREATE POLICY "members_update" ON org_members FOR UPDATE USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));
CREATE POLICY "members_delete" ON org_members FOR DELETE USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));

-- Workspaces
CREATE POLICY "workspaces_read"   ON workspaces FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "workspaces_all"    ON workspaces FOR ALL USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin','manager'));
CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT WITH CHECK (true);

-- Clients
CREATE POLICY "clients_read"   ON clients FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "clients_manage" ON clients FOR ALL USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin','manager'));

-- Projects
CREATE POLICY "projects_read"   ON projects FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "projects_manage" ON projects FOR ALL USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin','manager'));

-- Tasks
CREATE POLICY "tasks_read"   ON tasks FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (org_id = public.user_org_id() AND (public.user_org_role() IN ('owner','admin','manager') OR assignee_id = auth.uid()));
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));

-- Task comments
CREATE POLICY "comments_read"   ON task_comments FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "comments_insert" ON task_comments FOR INSERT WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "comments_update" ON task_comments FOR UPDATE USING (org_id = public.user_org_id() AND author_id = auth.uid());
CREATE POLICY "comments_delete" ON task_comments FOR DELETE USING (org_id = public.user_org_id() AND author_id = auth.uid());

-- Task activity
CREATE POLICY "activity_read" ON task_activity FOR SELECT USING (org_id = public.user_org_id());

-- Time logs
CREATE POLICY "time_read"   ON time_logs FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "time_insert" ON time_logs FOR INSERT WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "time_update" ON time_logs FOR UPDATE USING (org_id = public.user_org_id() AND user_id = auth.uid());
CREATE POLICY "time_delete" ON time_logs FOR DELETE USING (org_id = public.user_org_id() AND (user_id = auth.uid() OR public.user_org_role() IN ('owner','admin','manager')));

-- Labels
CREATE POLICY "labels_read"   ON labels FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "labels_manage" ON labels FOR ALL USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin','manager'));

-- Task labels
CREATE POLICY "task_labels_read"   ON task_labels FOR SELECT USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.org_id = public.user_org_id()));
CREATE POLICY "task_labels_manage" ON task_labels FOR ALL USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_labels.task_id AND tasks.org_id = public.user_org_id()));

-- Permissions
CREATE POLICY "perms_read"   ON org_permissions FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "perms_manage" ON org_permissions FOR ALL USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));

-- Features
CREATE POLICY "features_read"   ON org_feature_settings FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "features_manage" ON org_feature_settings FOR ALL USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));
CREATE POLICY "features_insert" ON org_feature_settings FOR INSERT WITH CHECK (true);

-- Notification preferences
CREATE POLICY "notif_own" ON notification_preferences FOR ALL USING (user_id = auth.uid());

-- Audit log
CREATE POLICY "audit_read" ON audit_log FOR SELECT USING (org_id = public.user_org_id() AND public.user_org_role() IN ('owner','admin'));
