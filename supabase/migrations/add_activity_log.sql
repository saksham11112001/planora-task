-- ── App-wide activity log ────────────────────────────────────────────────────
create table if not exists activity_log (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organisations(id) on delete cascade,
  user_id      uuid        references users(id) on delete set null,
  user_name    text,
  action       text        not null,
  -- e.g. 'task.created' | 'task.completed' | 'task.status_changed'
  --      'invoice.created' | 'invoice.status_changed'
  entity_type  text        not null,  -- 'task' | 'invoice'
  entity_id    uuid,
  entity_name  text,
  meta         jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists activity_log_org_id_idx      on activity_log(org_id);
create index if not exists activity_log_created_at_idx  on activity_log(org_id, created_at desc);
alter table  activity_log disable row level security;
grant all on activity_log to authenticated, anon, service_role;

notify pgrst, 'reload schema';
