-- Half-yearly MSME Form 1 declarations.
--
-- WHY THIS TABLE EXISTS
-- ---------------------
-- Form MSME-1 is filed TWICE a year. A company reports what it owed its MSME
-- suppliers as on 31 March (return due 30 April) and as on 30 September
-- (return due 31 October).
--
-- msme_vendors holds exactly ONE set of declaration fields per vendor, and
-- outstanding_amount is even commented "as on 31st March". So a firm running
-- the September cycle had nowhere to put the second figure: submitting it
-- overwrote the March one, and the two halves could never be seen side by
-- side. This table adds the missing period dimension.
--
-- THE SPLIT OF RESPONSIBILITY
-- ---------------------------
--   msme_vendors       = the VENDOR MASTER and the billing ledger.
--                        Identity, slot, payment_status, email_count,
--                        is_deleted. One row per vendor, forever.
--   msme_declarations  = one row per (vendor, period). What the vendor said,
--                        and when, for that specific half-year.
--
-- Deliberately NOT done by adding a `period` column to msme_vendors. That
-- would duplicate vendor identity on every row and break three things that
-- currently work: the partial unique index on (org_id, vendor_email), the
-- free-slot count, and the anti-gaming rule that a slot stays consumed after
-- a soft delete.
--
-- THE MIRROR (read this before changing any read path)
-- ----------------------------------------------------
-- The declaration fields on msme_vendors are KEPT, and now hold a mirror of
-- the vendor's most recent declaration. They are a cache, not a second source
-- of truth: lib/msme/declarations.ts recomputes them from this table after
-- every write, so they can always be rebuilt and can never be "the only copy".
--
-- This is what makes the change additive. Every existing read path — the
-- vendors list, the CSV export, the dashboard counts — keeps working against
-- the vendor row unchanged, while anything that needs a specific half-year
-- reads this table. Had the columns been dropped, 40-odd call sites in a live
-- revenue-bearing module would all have had to change in one go.

create table if not exists msme_declarations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  vendor_id   uuid not null references msme_vendors(id) on delete cascade,

  -- The "as on" date: 2026-03-31 or 2026-09-30. This IS the period identity —
  -- unambiguous, sortable, and the date the statute itself names. The check
  -- mirrors isValidPeriodEnd() in lib/msme/periods.ts; a declaration against
  -- any other date would be filed under a half-year that does not exist.
  period_end  date not null,
  constraint msme_declarations_period_end_half_yearly
    check (
      (extract(month from period_end) = 3 and extract(day from period_end) = 31)
      or
      (extract(month from period_end) = 9 and extract(day from period_end) = 30)
    ),

  -- Same vocabulary as msme_vendors.status, per period.
  status      text not null default 'pending'
              check (status in ('pending','emailed','submitted','not_msme')),

  -- What the vendor declared for THIS half-year.
  is_not_msme        boolean not null default false,
  udyam_number       text,
  pan                text,
  udyam_registered_on date,
  msme_category      text check (msme_category in ('micro','small','medium')),
  nature_of_business text check (nature_of_business in ('manufacturer','service_provider','trader')),
  -- The figure the whole return turns on: outstanding as on period_end.
  -- Never carried forward from the previous period — see CARRY_FORWARD_FIELDS.
  outstanding_amount numeric(15,2),
  cert_url           text,   -- Udyam certificate (carried forward; does not change)
  proof_url          text,   -- supporting document for THIS period's balance
  declarant_name     text,
  declared_at        timestamptz,
  consent_at         timestamptz,   -- DPDP Act, 2023: consent is per submission
  submitted_at       timestamptz,

  -- Email tracking is per period: a vendor chased three times for September
  -- starts again from zero for March.
  email_count     int not null default 0,
  last_emailed_at timestamptz,
  email_bounced   boolean not null default false,
  bounce_reason   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One declaration per vendor per half-year. This is the constraint that
  -- makes a second submission an UPDATE rather than a duplicate row, and it is
  -- what the submit route relies on.
  constraint msme_declarations_vendor_period_uq unique (vendor_id, period_end)
);

-- The vendors list for one period, which is the module's main query.
create index if not exists msme_declarations_org_period_idx
  on msme_declarations (org_id, period_end);

-- A vendor's history, newest first — drives carry-forward lookup and the
-- per-vendor timeline.
create index if not exists msme_declarations_vendor_period_idx
  on msme_declarations (vendor_id, period_end desc);

-- The daily reminder cron: outstanding chases for one period.
create index if not exists msme_declarations_reminder_idx
  on msme_declarations (org_id, period_end, email_count, last_emailed_at)
  where status = 'emailed';


-- ── Tokens and the email log become period-aware ──────────────────────────
--
-- A magic link is for ONE half-year. Without this, a vendor who kept the
-- September email could reopen that link in April and overwrite the September
-- declaration with March figures.
--
-- Nullable, not defaulted: an old token minted before this migration has no
-- period, and the submit route treats a null period as the period that was
-- current when the token was created. Defaulting them all to one date would
-- misfile whichever half they actually belonged to.
alter table msme_tokens
  add column if not exists period_end date;

alter table msme_email_log
  add column if not exists period_end date;

create index if not exists msme_email_log_vendor_period_idx
  on msme_email_log (vendor_id, period_end);

-- The audit export pages through this table ordered by (sent_at, id), which
-- without a matching index means a sort of the org's whole send history on
-- every page of every export.
create index if not exists msme_email_log_org_sent_idx
  on msme_email_log (org_id, sent_at, id);


-- ── Backfill: every existing submission becomes its period's declaration ──
--
-- Which period does an existing row belong to? The one that was current when
-- the vendor answered — the most recent half-year that had CLOSED by then,
-- which is exactly what currentPeriod() in lib/msme/periods.ts computes.
-- A vendor who submitted in August 2026 was stating 31 March 2026 figures
-- (matching the old column comment); one who submitted in October 2026 was
-- stating 30 September 2026 figures.
--
-- Rows never emailed and never submitted are left alone: there is nothing to
-- preserve, and inventing a 'pending' declaration for them would make the
-- first real cycle look already under way.
with src as (
  select v.*,
         -- When did this vendor last do anything? That fixes which half-year
         -- the stored figures belong to.
         coalesce(v.submitted_at, v.declared_at, v.last_emailed_at, v.created_at)::date as anchor
  from msme_vendors v
  -- Never emailed and never submitted: nothing to preserve. Inventing a
  -- 'pending' declaration would make the first real cycle look under way.
  where v.status <> 'pending' or v.email_count > 0
),
dated as (
  select src.*,
         case
           when anchor >= make_date(extract(year from anchor)::int, 9, 30)
             then make_date(extract(year from anchor)::int, 9, 30)
           when anchor >= make_date(extract(year from anchor)::int, 3, 31)
             then make_date(extract(year from anchor)::int, 3, 31)
           -- Jan–Mar: the last closed half-year ended the previous September.
           else make_date(extract(year from anchor)::int - 1, 9, 30)
         end as period_end
  from src
)
insert into msme_declarations (
  org_id, vendor_id, period_end, status,
  is_not_msme, udyam_number, pan, udyam_registered_on,
  msme_category, nature_of_business, outstanding_amount,
  cert_url, proof_url, declarant_name, declared_at, consent_at, submitted_at,
  email_count, last_emailed_at, email_bounced, bounce_reason,
  created_at, updated_at
)
select
  org_id, id, period_end, status,
  is_not_msme, udyam_number, pan, udyam_registered_on,
  msme_category, nature_of_business, outstanding_amount,
  cert_url, proof_url, declarant_name, declared_at, consent_at, submitted_at,
  email_count, last_emailed_at,
  -- email_bounced was added nullable, so pre-existing rows hold NULL and the
  -- NOT NULL column here would reject them.
  coalesce(email_bounced, false), bounce_reason,
  created_at, updated_at
from dated
-- Idempotent: re-running adds nothing, because the unique constraint is on
-- (vendor_id, period_end) and a backfilled vendor already has its row.
on conflict (vendor_id, period_end) do nothing;


-- RLS: enabled with no policies, i.e. deny-all. Matches msme_vendors — every
-- read and write goes through an API route that has already resolved org_id
-- and run the permission gate, using the service-role client.
alter table msme_declarations enable row level security;
