-- ── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id      uuid        REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number text        NOT NULL,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issue_date     date        NOT NULL DEFAULT CURRENT_DATE,
  due_date       date,
  items          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  subtotal       numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate       numeric(5,2)  NOT NULL DEFAULT 0,
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0,
  discount       numeric(14,2) NOT NULL DEFAULT 0,
  total          numeric(14,2) NOT NULL DEFAULT 0,
  notes          text,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz
);

CREATE INDEX IF NOT EXISTS invoices_org_id_idx       ON invoices(org_id);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx    ON invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx       ON invoices(status);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_org_idx ON invoices(org_id, invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_org_read ON invoices
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY invoices_org_write ON invoices
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','manager')
    )
  );

-- Auto-bump updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE PROCEDURE update_invoices_updated_at();

-- ── Client Notes / Activity Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  content    text        NOT NULL,
  type       text        NOT NULL DEFAULT 'note'
             CHECK (type IN ('note','call','meeting','email','whatsapp')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_notes_org_client_idx ON client_notes(org_id, client_id);
CREATE INDEX IF NOT EXISTS client_notes_created_idx    ON client_notes(created_at DESC);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_notes_read ON client_notes
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY client_notes_write ON client_notes
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
