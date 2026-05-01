-- ── Client groups ─────────────────────────────────────────────────────────────
create table if not exists client_groups (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references organisations(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#0d9488',
  notes       text,
  created_by  uuid        references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists client_groups_org_id_idx on client_groups(org_id);
alter table  client_groups disable row level security;
grant all on client_groups to authenticated, anon, service_role;

-- ── Add group_id to clients ────────────────────────────────────────────────────
alter table clients
  add column if not exists group_id uuid references client_groups(id) on delete set null;

create index if not exists clients_group_id_idx on clients(group_id);

notify pgrst, 'reload schema';
