-- ── Trial tracking columns ───────────────────────────────────────────────────
alter table organisations
  add column if not exists trial_started_at     timestamptz,
  add column if not exists trial_extension_days integer     not null default 0,
  add column if not exists referral_code        text        unique,
  add column if not exists join_code            text        unique;

-- Back-fill trial_started_at for existing trialing orgs (estimate from trial_ends_at - 14 days)
update organisations
set trial_started_at = trial_ends_at - interval '14 days'
where trial_started_at is null
  and trial_ends_at is not null;

-- ── Referral redemptions ─────────────────────────────────────────────────────
-- Tracks which org used which referral code and how many extension days were granted.
create table if not exists referral_redemptions (
  id              uuid        primary key default gen_random_uuid(),
  referrer_org_id uuid        not null references organisations(id) on delete cascade,
  redeemer_org_id uuid        not null references organisations(id) on delete cascade,
  extension_days  integer     not null default 7,
  created_at      timestamptz not null default now(),
  -- Each org can only redeem one referral (prevents farming multiple extensions)
  unique (redeemer_org_id)
);

create index if not exists rr_referrer_idx on referral_redemptions(referrer_org_id);

-- ── RLS for referral_redemptions ─────────────────────────────────────────────
alter table referral_redemptions enable row level security;

-- Org members can see redemptions related to their org only
create policy "rr_read" on referral_redemptions
  for select using (
    referrer_org_id = user_org_id() or
    redeemer_org_id = user_org_id()
  );

-- Only system/service role can insert (done via admin client in API routes)
create policy "rr_insert" on referral_redemptions
  for insert with check (false);
