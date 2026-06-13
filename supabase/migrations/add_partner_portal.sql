-- Partner Portal
-- Builds on existing referral_redemptions (referrer_org_id, redeemer_org_id).
-- Tracks monetary commissions + payout requests.

-- ── Commission tiers (stored for historical accuracy, re-computed in app) ────
-- Bronze: 1-4 active referred orgs → 10%
-- Silver: 5-9                       → 15%
-- Gold:   10+                        → 20%

-- ── partner_commissions ───────────────────────────────────────────────────────
create table if not exists partner_commissions (
  id                uuid primary key default gen_random_uuid(),
  partner_org_id    uuid not null references organisations(id) on delete cascade,
  referred_org_id   uuid not null references organisations(id) on delete cascade,
  event             text not null,                 -- 'plan_upgraded', 'subscription_renewed', etc.
  plan_tier         text not null,                 -- snapshot of referred org plan at event time
  commission_paise  integer not null,              -- partner's cut in paise
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'paid')),
  payout_id         uuid,                          -- set when included in a payout batch
  created_at        timestamptz not null default now()
);

create index if not exists partner_commissions_partner_idx  on partner_commissions(partner_org_id);
create index if not exists partner_commissions_referred_idx on partner_commissions(referred_org_id);
create index if not exists partner_commissions_status_idx   on partner_commissions(status);

alter table partner_commissions enable row level security;
-- Only service role (admin client) writes; owners read their own
create policy "partner org reads own commissions"
  on partner_commissions for select
  using (
    partner_org_id in (
      select org_id from org_members where user_id = auth.uid() and is_active = true
    )
  );

-- ── partner_payouts ───────────────────────────────────────────────────────────
create table if not exists partner_payouts (
  id              uuid primary key default gen_random_uuid(),
  partner_org_id  uuid not null references organisations(id) on delete cascade,
  amount_paise    integer not null,
  status          text not null default 'requested'
                  check (status in ('requested', 'processing', 'paid', 'rejected')),
  bank_details    jsonb not null,                  -- { account_no, ifsc, account_name }
  note            text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);

create index if not exists partner_payouts_org_idx    on partner_payouts(partner_org_id);
create index if not exists partner_payouts_status_idx on partner_payouts(status);

alter table partner_payouts enable row level security;
create policy "partner org reads own payouts"
  on partner_payouts for select
  using (
    partner_org_id in (
      select org_id from org_members where user_id = auth.uid() and is_active = true
    )
  );
create policy "partner org inserts own payouts"
  on partner_payouts for insert
  with check (
    partner_org_id in (
      select org_id from org_members where user_id = auth.uid() and role in ('owner') and is_active = true
    )
  );
