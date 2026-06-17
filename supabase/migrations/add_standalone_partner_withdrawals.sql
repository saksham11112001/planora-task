-- Standalone partner withdrawal requests
-- Partners submit a request with their bank details.
-- Admin processes manually and marks the status accordingly.
CREATE TABLE IF NOT EXISTS standalone_partner_withdrawals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid        NOT NULL REFERENCES standalone_partners(id) ON DELETE CASCADE,
  amount_paise    integer     NOT NULL,
  account_name    text        NOT NULL,
  bank_account    text        NOT NULL,
  bank_ifsc       text        NOT NULL,
  upi_id          text,
  status          text        NOT NULL DEFAULT 'requested'
                              CHECK (status IN ('requested', 'processing', 'paid', 'rejected')),
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_standalone_partner_withdrawals_partner
  ON standalone_partner_withdrawals(partner_id);
