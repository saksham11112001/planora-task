create table if not exists client_notices (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  title        text not null,
  notice_type  text not null default 'income_tax', -- income_tax | gst | roc | labour | other
  portal       text not null default 'income_tax', -- income_tax | gst | mca | traces | epfo | other
  notice_date  date,
  response_due date,
  status       text not null default 'action_pending', -- action_pending | response_filed | closed
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_notices_org_id_idx on client_notices(org_id);
create index if not exists client_notices_client_id_idx on client_notices(client_id);
