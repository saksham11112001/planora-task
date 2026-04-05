-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  description      TEXT,
  discount_type    TEXT NOT NULL DEFAULT 'free_plan'
                     CHECK (discount_type IN ('free_plan','percent','fixed_inr')),
  discount_percent INTEGER CHECK (discount_percent BETWEEN 1 AND 100),
  discount_inr     INTEGER,
  plan_tier        TEXT CHECK (plan_tier IN ('starter','pro','business')),
  duration_months  INTEGER DEFAULT 1,
  max_uses         INTEGER,           -- NULL = unlimited
  uses_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);

-- Track which org redeemed which coupon (prevents double redemption)
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, org_id)
);

-- RLS: Only service role can write; authenticated users can read their own redemptions
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_coupons" ON coupons FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_active_coupons" ON coupons FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "service_all_redemptions" ON coupon_redemptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed data: mix of free-plan and percent-discount coupons
INSERT INTO coupons (code, description, discount_type, plan_tier, duration_months, max_uses, discount_percent, expires_at) VALUES
-- Full free-plan access coupons
('SGNG2025FREE', 'SNG internal — 1 year Pro access',           'free_plan', 'pro',      12, NULL, NULL, NULL),
('BETAUSER',     'Beta users — 6 months Starter free',         'free_plan', 'starter',  6,  100,  NULL, '2026-12-31 23:59:59+00'),
('PARTNER50',    'Partner programme — 3 months Pro free',      'free_plan', 'pro',      3,  50,   NULL, NULL),
('EARLYBIRD',    'Early bird — 3 months Pro free',             'free_plan', 'pro',      3,  200,  NULL, '2026-06-30 23:59:59+00'),
('CA2025',       'CA firms promo — 6 months Pro free',         'free_plan', 'pro',      6,  500,  NULL, '2026-12-31 23:59:59+00'),
('LAUNCH100',    'Launch promo — 1 month Business free',       'free_plan', 'business', 1,  100,  NULL, NULL),
('FREEPRO3',     '3 months Pro — gifted access',               'free_plan', 'pro',      3,  NULL, NULL, NULL),
('STARTER6FREE', '6 months Starter — special offer',           'free_plan', 'starter',  6,  NULL, NULL, NULL),
-- Percentage discount coupons (for future Razorpay integration)
('HALF50',       '50% off first payment',                       'percent',   NULL,       1,  1000, 50,   NULL),
('SAVE30',       '30% off any plan',                            'percent',   NULL,       1,  500,  30,   NULL),
('ANNUAL20',     '20% off — annual billing incentive',          'percent',   NULL,       12, NULL, 20,   NULL),
('WELCOME10',    '10% off welcome discount',                    'percent',   NULL,       1,  NULL, 10,   NULL),
('FLASH40',      '40% flash sale discount',                     'percent',   NULL,       1,  200,  40,   '2026-06-30 23:59:59+00'),
('CA50OFF',      '50% off for CA firms',                        'percent',   NULL,       1,  300,  50,   '2026-12-31 23:59:59+00')
ON CONFLICT (code) DO NOTHING;
