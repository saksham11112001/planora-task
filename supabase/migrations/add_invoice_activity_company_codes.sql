-- ── Invoice activity log ─────────────────────────────────────────────────────
create table if not exists invoice_activity (
  id          uuid        primary key default gen_random_uuid(),
  invoice_id  uuid        not null references invoices(id) on delete cascade,
  org_id      uuid        not null references organisations(id) on delete cascade,
  user_id     uuid        references users(id) on delete set null,
  user_name   text,
  action      text        not null,  -- 'created' | 'status_changed' | 'updated'
  meta        jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists invoice_activity_invoice_id_idx on invoice_activity(invoice_id);
alter table  invoice_activity disable row level security;
grant all on invoice_activity to authenticated, anon, service_role;

-- ── Group company codes ───────────────────────────────────────────────────────
create table if not exists invoice_company_codes (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references organisations(id) on delete cascade,
  label       text        not null,
  group_name  text,
  gstin       text,
  pan         text,
  cin         text,
  address     text,
  is_default  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoice_company_codes_org_id_idx on invoice_company_codes(org_id);
alter table  invoice_company_codes disable row level security;
grant all on invoice_company_codes to authenticated, anon, service_role;

notify pgrst, 'reload schema';
