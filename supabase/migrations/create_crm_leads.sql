-- ============================================================================
-- CRM: leads, pipeline, activities and proposals
--
-- The gap this fills: upFloat managed work for clients a firm ALREADY had.
-- There was nowhere to put an enquiry, no pipeline, and no way to send a
-- quotation. A firm comparing upFloat with a competitor that does both sees
-- half a product.
--
-- Access pattern as with every table added recently: RLS ENABLED with NO
-- policies (deny-all for anon and authenticated), reached only by API routes
-- using the service role after resolving org_id and running the permission
-- gate.
--
-- Safe to run more than once.
-- ============================================================================


-- ── Leads ───────────────────────────────────────────────────────────────────
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,

  name          text not null,              -- the person
  company       text,
  email         text,
  phone         text,

  -- Where the enquiry came from. Free text rather than an enum: every firm
  -- counts its sources differently and an enum would need a migration per
  -- firm's reporting habit.
  source        text,

  -- Pipeline position. 'won' and 'lost' are terminal.
  stage         text not null default 'new'
                check (stage in ('new','contacted','qualified','proposal','negotiation','won','lost')),

  -- Expected fee. Stored in the ORG's currency; there is one currency per
  -- org throughout the app, so a per-row currency column would be a lie
  -- waiting to be believed.
  value         numeric(14,2),

  expected_close date,

  -- Who in the firm owns the conversation.
  owner_id      uuid references users(id) on delete set null,

  notes         text,

  -- Set when the lead becomes a client. Also the guard that stops a lead
  -- being converted twice into two duplicate client records.
  converted_client_id uuid references clients(id) on delete set null,
  converted_at  timestamptz,

  -- Why it was lost. Worth more than the stage alone when reviewing a
  -- quarter's pipeline.
  lost_reason   text,

  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_org_stage_idx   on leads(org_id, stage);
create index if not exists leads_org_created_idx on leads(org_id, created_at desc);
create index if not exists leads_owner_idx       on leads(owner_id) where owner_id is not null;


-- ── Lead activity log ───────────────────────────────────────────────────────
-- Append-only history: calls, emails, meetings, notes, and stage changes.
-- Stage changes are written here by the API so the pipeline has a story
-- rather than just a current position.
create table if not exists lead_activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  lead_id     uuid not null references leads(id) on delete cascade,

  kind        text not null default 'note'
              check (kind in ('note','call','email','meeting','stage_change','proposal')),
  body        text,

  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on lead_activities(lead_id, created_at desc);


-- ── Proposals / quotations ──────────────────────────────────────────────────
create table if not exists proposals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,

  -- A proposal belongs to a lead, or to an existing client for repeat work.
  -- Exactly one of the two, enforced below.
  lead_id     uuid references leads(id)   on delete cascade,
  client_id   uuid references clients(id) on delete cascade,

  number      text not null,               -- human reference, unique per org
  title       text not null,

  status      text not null default 'draft'
              check (status in ('draft','sent','accepted','rejected','expired')),

  -- Line items as JSONB rather than a child table.
  --
  -- A quotation is read, sent and accepted as one whole document; nothing in
  -- the app queries across individual lines. A child table would add a join
  -- and an ordering column to every read for no present benefit. If
  -- line-level reporting is ever wanted, this becomes a table then.
  --
  -- Shape: [{ description, qty, rate, amount }]
  items       jsonb not null default '[]'::jsonb,

  -- Totals are STORED, not derived on read. A sent quotation is a statement
  -- of a number on a date; recomputing it later from a changed tax rate
  -- would silently rewrite what the client was told.
  subtotal    numeric(14,2) not null default 0,
  tax_rate    numeric(5,2)  not null default 0,
  tax_amount  numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0,

  valid_until date,
  sent_at     timestamptz,
  decided_at  timestamptz,
  notes       text,

  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A proposal with neither owner is unreachable; one with both is
  -- ambiguous about who is being quoted.
  constraint proposals_one_owner check (
    (lead_id is not null and client_id is null) or
    (lead_id is null and client_id is not null)
  )
);

-- Human-facing reference, unique within a firm.
create unique index if not exists proposals_org_number_uidx on proposals(org_id, number);
create index if not exists proposals_org_status_idx on proposals(org_id, status);
create index if not exists proposals_lead_idx   on proposals(lead_id)   where lead_id   is not null;
create index if not exists proposals_client_idx on proposals(client_id) where client_id is not null;


-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table leads           enable row level security;
alter table lead_activities enable row level security;
alter table proposals       enable row level security;
