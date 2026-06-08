create table if not exists client_credentials (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  portal_name  text not null,             -- e.g. "Income Tax Portal", "GST Portal", "MCA21"
  username     text not null,
  password_enc text not null,             -- base64 encoded (simple obfuscation; not crypto-safe but better than plaintext)
  notes        text,
  last_updated timestamptz default now(),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists client_credentials_org_client_idx on client_credentials(org_id, client_id);
