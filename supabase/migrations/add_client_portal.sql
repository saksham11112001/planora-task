-- Client Portal: new tables and column additions
-- Run after existing migrations

-- 1. Add email to clients if not already present
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Add task_types to ca_master_tasks if not already present
ALTER TABLE ca_master_tasks ADD COLUMN IF NOT EXISTS task_types TEXT[] NOT NULL DEFAULT '{}';

-- 3. Per-org document type library
CREATE TABLE IF NOT EXISTS client_document_types (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  category          TEXT        NOT NULL
                    CHECK (category IN ('evergreen','monthly','quarterly','annual')),
  linked_task_types TEXT[]      NOT NULL DEFAULT '{}',
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_document_types_org_idx ON client_document_types(org_id);

-- 4. Magic link tokens (one active token per client)
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  portal_url  TEXT,                                       -- full URL stored at generation time (hash is irreversible)
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, client_id)
);

CREATE INDEX IF NOT EXISTS client_portal_tokens_hash_idx ON client_portal_tokens(token_hash);

-- 5. Client document uploads
CREATE TABLE IF NOT EXISTS client_document_uploads (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_type_id UUID        NOT NULL REFERENCES client_document_types(id) ON DELETE CASCADE,
  period_key       TEXT,
  file_url         TEXT        NOT NULL,
  file_name        TEXT        NOT NULL,
  file_size        INTEGER,
  mime_type        TEXT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_document_uploads_client_idx ON client_document_uploads(client_id);
CREATE INDEX IF NOT EXISTS client_document_uploads_org_idx    ON client_document_uploads(org_id);

-- 6. Upload ↔ task links (many-to-many)
CREATE TABLE IF NOT EXISTS client_doc_task_links (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id     UUID        NOT NULL REFERENCES client_document_uploads(id) ON DELETE CASCADE,
  task_id       UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  attachment_id UUID        REFERENCES task_attachments(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (upload_id, task_id)
);

CREATE INDEX IF NOT EXISTS client_doc_task_links_task_idx ON client_doc_task_links(task_id);
