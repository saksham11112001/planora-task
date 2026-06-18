-- Razorpay subscription columns on organisations
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_id      text;

-- Billing events log (subscription webhooks write here)
CREATE TABLE IF NOT EXISTS billing_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  subscription_id text,
  payment_id      text,
  amount_paise    bigint,
  status          text,
  raw_payload     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_org_id_idx ON billing_events(org_id);
CREATE INDEX IF NOT EXISTS billing_events_created_at_idx ON billing_events(created_at DESC);
