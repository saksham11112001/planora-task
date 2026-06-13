-- MSME Compliance Tracker
-- Vendors tracked by firm; vendor fills form via magic-link token

create table if not exists msme_vendors (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  vendor_name     text not null,
  vendor_email    text not null,
  gstin           text,
  -- submission data (filled by vendor)
  status          text not null default 'pending'
                  check (status in ('pending','emailed','submitted','not_msme')),
  udyam_number    text,
  msme_category   text check (msme_category in ('micro','small','medium')),
  nature_of_business text check (nature_of_business in ('manufacturer','service_provider','trader')),
  outstanding_amount numeric(15,2),  -- last outstanding as on 31st March
  cert_url        text,             -- uploaded certificate URL
  is_not_msme     boolean not null default false,  -- non-MSME declaration
  declarant_name  text,             -- name entered in non-MSME declaration
  declared_at     timestamptz,
  submitted_at    timestamptz,
  -- email tracking
  email_count     int not null default 0,
  last_emailed_at timestamptz,
  -- billing
  is_paid         boolean not null default false,  -- false for first 5 (free demo)
  -- meta
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Magic-link tokens for vendor form (unauthenticated access)
create table if not exists msme_tokens (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references msme_vendors(id) on delete cascade,
  org_id      uuid not null,
  token_hash  text not null unique,  -- SHA-256 of raw token
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Email send log per vendor (tracks attempt 1/2/3)
create table if not exists msme_email_log (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references msme_vendors(id) on delete cascade,
  org_id      uuid not null,
  attempt_no  int not null,  -- 1, 2, 3
  sent_at     timestamptz not null default now(),
  opened_at   timestamptz
);

-- Indexes
create index if not exists msme_vendors_org_id_idx    on msme_vendors(org_id);
create index if not exists msme_tokens_token_hash_idx on msme_tokens(token_hash);
create index if not exists msme_email_log_vendor_idx  on msme_email_log(vendor_id);

-- RLS: firm members can only see their own org's vendors
alter table msme_vendors   enable row level security;
alter table msme_tokens    enable row level security;
alter table msme_email_log enable row level security;

-- Service-role (admin client) bypasses RLS — that is the only access pattern used
-- by API routes. No end-user direct Supabase SDK calls to these tables.
