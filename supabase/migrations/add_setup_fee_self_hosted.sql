-- Add setup fee tracking and self-hosted interest to organisations
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS setup_fee_paid       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_hosted_interest BOOLEAN NOT NULL DEFAULT false;

-- Track self-hosted inquiries submitted by orgs
CREATE TABLE IF NOT EXISTS self_hosted_inquiries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_name   TEXT NOT NULL,
  contact_email  TEXT NOT NULL,
  company_size   TEXT,
  infrastructure TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE self_hosted_inquiries ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write inquiry records (admin review happens outside the app)
CREATE POLICY "service role manages self_hosted_inquiries"
  ON self_hosted_inquiries FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
