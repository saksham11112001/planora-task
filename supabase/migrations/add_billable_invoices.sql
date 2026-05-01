-- ── Billable flag on tasks ────────────────────────────────────────────────────
alter table tasks
  add column if not exists is_billable    boolean      not null default false,
  add column if not exists billable_amount numeric(12,2) default null;

-- ── Invoices ─────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references organisations(id) on delete cascade,
  client_id       uuid        references clients(id) on delete set null,
  invoice_number  text        not null,
  title           text        not null,
  issue_date      date        not null default current_date,
  due_date        date,
  status          text        not null default 'draft'
                              check (status in ('draft','sent','paid','cancelled')),
  notes           text,
  gstin           text,
  gst_rate        numeric(5,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  subtotal        numeric(12,2) not null default 0,
  gst_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  created_by      uuid        references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Invoice line items ────────────────────────────────────────────────────────
create table if not exists invoice_items (
  id          uuid        primary key default gen_random_uuid(),
  invoice_id  uuid        not null references invoices(id) on delete cascade,
  org_id      uuid        not null references organisations(id) on delete cascade,
  task_id     uuid        references tasks(id) on delete set null,
  description text        not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists invoices_org_id_idx      on invoices(org_id);
create index if not exists invoices_client_id_idx   on invoices(client_id);
create index if not exists invoices_status_idx      on invoices(status);
create index if not exists invoice_items_invoice_id_idx on invoice_items(invoice_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table invoices      enable row level security;
alter table invoice_items enable row level security;

-- invoices: org members can read; owner/admin/manager can write
create policy "invoices_read"   on invoices      for select using (org_id = user_org_id());
create policy "invoices_insert" on invoices      for insert with check (org_id = user_org_id());
create policy "invoices_update" on invoices      for update using (org_id = user_org_id());
create policy "invoices_delete" on invoices      for delete using (org_id = user_org_id() and user_org_role() in ('owner','admin','manager'));

create policy "inv_items_read"   on invoice_items for select using (org_id = user_org_id());
create policy "inv_items_insert" on invoice_items for insert with check (org_id = user_org_id());
create policy "inv_items_update" on invoice_items for update using (org_id = user_org_id());
create policy "inv_items_delete" on invoice_items for delete using (org_id = user_org_id());

-- ── Auto-updated_at trigger ───────────────────────────────────────────────────
create or replace function update_invoices_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists invoices_updated_at on invoices;
create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_invoices_updated_at();
