-- ============================================================================
-- Attendance & Leave
--
-- A firm-facing HR surface: daily check-in/check-out per team member, and a
-- leave request -> approval -> balance flow.
--
-- Access pattern, matching msme_vendors and the rest of the newer tables:
-- RLS is ENABLED with NO policies, which denies every request made with the
-- anon or authenticated key. All reads and writes go through API routes using
-- createAdminClient() (service role), which bypasses RLS, after the route has
-- resolved org_id from org_members and run the permission gate. Nothing in the
-- app talks to these tables with the browser SDK.
--
-- Safe to run more than once.
-- ============================================================================


-- ── Attendance ──────────────────────────────────────────────────────────────
-- One row per member per day. check_out_at stays null until they check out,
-- which is also how "currently checked in" is detected.
create table if not exists attendance_records (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,

  -- The working day this belongs to, in the ORG's timezone. Computed by the
  -- API, never by the database: now() here is UTC, so a 9pm check-in in
  -- Asia/Kolkata would otherwise be filed under the following day.
  work_date      date not null,

  check_in_at    timestamptz,
  check_out_at   timestamptz,

  -- Geo-tagged check-in, for firms with audit staff doing client visits.
  -- Optional at every level: a firm that does not want location simply never
  -- sends it, and nothing downstream requires it.
  check_in_lat   numeric(9,6),
  check_in_lng   numeric(9,6),
  check_in_label text,
  check_out_lat  numeric(9,6),
  check_out_lng  numeric(9,6),
  check_out_label text,

  status         text not null default 'present'
                 check (status in ('present','half_day','on_leave','holiday','absent')),

  -- 'self'   — the member used the check-in button
  -- 'manual' — an admin recorded or corrected it on their behalf
  source         text not null default 'self' check (source in ('self','manual')),

  notes          text,

  -- Set only when source = 'manual', so an edited row is always identifiable.
  recorded_by    uuid references users(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One attendance row per person per day. This is the constraint that makes
-- "check in" idempotent: a double tap hits the conflict instead of opening a
-- second row and orphaning the first.
create unique index if not exists attendance_records_user_date_uidx
  on attendance_records(user_id, work_date);

-- The two read paths: "my attendance over a range" and "the whole org on a
-- given day / range".
create index if not exists attendance_records_org_date_idx
  on attendance_records(org_id, work_date desc);


-- ── Leave ───────────────────────────────────────────────────────────────────
create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,

  leave_type    text not null default 'casual'
                check (leave_type in ('casual','sick','earned','unpaid','comp_off','maternity','other')),

  start_date    date not null,
  end_date      date not null,

  -- A half day is a single date with half_day set; the API rejects half_day
  -- on a multi-day range rather than silently guessing which half.
  half_day      boolean not null default false,

  -- Denormalised working-day count, computed by the API at submit time and
  -- recomputed on approval. Stored because balances are reported constantly
  -- and recounting weekends across a date range on every read is wasteful.
  days_count    numeric(4,1) not null default 1,

  reason        text,

  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','cancelled')),

  decided_by    uuid references users(id) on delete set null,
  decided_at    timestamptz,
  decision_note text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A range that ends before it starts is always a bug, never a user intent.
  constraint leave_requests_date_order check (end_date >= start_date)
);

create index if not exists leave_requests_org_status_idx
  on leave_requests(org_id, status);
create index if not exists leave_requests_user_idx
  on leave_requests(user_id, start_date desc);


-- Per-member yearly entitlement. 'used' is maintained by the API when a
-- request is approved or an approval is reversed, not by a trigger — keeping
-- the arithmetic in one place that is already inside a permission check.
create table if not exists leave_balances (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  year        int  not null,
  leave_type  text not null
              check (leave_type in ('casual','sick','earned','unpaid','comp_off','maternity','other')),
  entitled    numeric(5,1) not null default 0,
  used        numeric(5,1) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists leave_balances_user_year_type_uidx
  on leave_balances(user_id, year, leave_type);
create index if not exists leave_balances_org_year_idx
  on leave_balances(org_id, year);


-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Enabled with no policies = deny all for anon/authenticated. Service role
-- bypasses it, and that is the only path the app uses.
alter table attendance_records enable row level security;
alter table leave_requests     enable row level security;
alter table leave_balances     enable row level security;
