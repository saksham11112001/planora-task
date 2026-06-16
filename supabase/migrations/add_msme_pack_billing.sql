-- Switch MSME Tracker to pack-based billing.
-- Pack info is stored in org_feature_settings with feature_key='msme_pack'.
-- config: { tier: 'pack_20', vendor_limit: 20, paid_at: '...' }
-- No schema change needed — org_feature_settings already has a free-form config jsonb column.

-- Record pack purchases (replaces per-vendor msme_payments for new billing model)
CREATE TABLE IF NOT EXISTS msme_pack_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  pack_tier        text NOT NULL,
  vendor_limit     int  NOT NULL,
  amount_paise     int  NOT NULL,
  gateway          text NOT NULL DEFAULT 'manual',  -- 'cashfree' | 'razorpay' | 'manual'
  gateway_order_id text,
  gateway_payment_id text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz,
  UNIQUE (gateway_order_id)
);

CREATE INDEX IF NOT EXISTS idx_msme_pack_payments_org ON msme_pack_payments(org_id);
