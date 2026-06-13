-- Add payment_status to msme_vendors
-- 'free'    = within the first 5 free slots, no payment needed
-- 'unpaid'  = paid slot, payment not yet made — shoot-email is blocked
-- 'paid'    = payment confirmed, fully unlocked

alter table msme_vendors
  add column if not exists payment_status text not null default 'free'
  check (payment_status in ('free', 'unpaid', 'paid'));

-- Backfill: existing rows — is_paid=false → free, is_paid=true → unpaid (not yet paid)
update msme_vendors set payment_status = 'free'   where is_paid = false;
update msme_vendors set payment_status = 'unpaid' where is_paid = true;

-- Track Razorpay payments per vendor slot
create table if not exists msme_payments (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references msme_vendors(id) on delete cascade,
  org_id          uuid not null,
  amount_paise    int not null default 9900,  -- ₹99 in paise
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  status          text not null default 'created'
                  check (status in ('created', 'paid', 'failed')),
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);

create index if not exists msme_payments_vendor_idx on msme_payments(vendor_id);
create index if not exists msme_payments_org_idx    on msme_payments(org_id);

alter table msme_payments enable row level security;
