-- Bill-wise outstanding, and the two fields Form MSME-1 actually asks for.
--
-- RUN add_msme_declarations.sql FIRST. This file adds two columns to
-- msme_declarations, so on an empty schema it stops with
-- `relation "msme_declarations" does not exist` — harmlessly, and before
-- anything is created, but it will not do what you asked.
--
-- WHY AN INVOICE LEDGER
-- --------------------
-- Until now the module asked the VENDOR for a single number: "outstanding as
-- on <date>". That is enough to populate a tracker, but not enough for the two
-- things a CA firm is actually paid to produce:
--
--   Form MSME-1 wants, per supplier, the amount outstanding AND the date from
--   which it has been outstanding. A single balance cannot say when it became
--   due.
--
--   Section 43B(h) of the Income-tax Act disallows a deduction for any sum
--   payable to a MICRO or SMALL enterprise beyond the section 15 MSMED time
--   limit (15 days, or up to 45 where there is a written agreement). That test
--   is per invoice, against that invoice's own date. A closing balance cannot
--   be tested against it at all.
--
-- So invoices are stored as facts, with no period attached. The outstanding
-- balance as on any date is then derived rather than asked for:
--
--   sum(amount - paid_amount) where invoice_date <= D
--                               and (payment_date is null or payment_date > D)
--
-- which means one import serves every reporting period, past and future, and
-- the 43B(h) test becomes exact instead of an approximation.
--
-- The vendor-declared figure is NOT replaced. It stays the primary source
-- where no ledger has been imported, and where both exist it becomes a
-- cross-check — a vendor claiming more than the buyer's books show is exactly
-- the disagreement a firm wants surfaced before it files.

create table if not exists msme_invoices (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  vendor_id  uuid not null references msme_vendors(id) on delete cascade,

  invoice_no   text,
  invoice_date date           not null,
  amount       numeric(15,2)  not null check (amount >= 0),

  -- Part payments are common, so the ledger tracks how much of the invoice has
  -- been settled rather than a paid/unpaid flag.
  paid_amount  numeric(15,2)  not null default 0 check (paid_amount >= 0),
  -- The date the invoice was settled IN FULL. Null while anything is still
  -- outstanding. This is what the "as on" derivation and the 43B(h) clock both
  -- read, so a part-paid invoice correctly stays outstanding.
  payment_date date,

  -- Days agreed IN WRITING for payment. Null means no written agreement, which
  -- under section 15 makes the limit 15 days. Section 15 caps any agreement at
  -- 45 days, and the check enforces that rather than trusting input — an
  -- agreement for 90 days does not extend the statutory limit, so storing 90
  -- would silently compute a wrong disallowance.
  agreement_days int check (agreement_days is null or (agreement_days >= 0 and agreement_days <= 45)),

  -- Where the row came from, so an imported ledger can be distinguished from
  -- figures entered by hand when the two disagree.
  source text not null default 'manual'
         check (source in ('manual', 'ledger_import', 'vendor')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The balance derivation and the 43B(h) scan both read a vendor's invoices by
-- date.
create index if not exists msme_invoices_vendor_date_idx
  on msme_invoices (vendor_id, invoice_date);

-- Org-wide scans: the exposure report and the ledger reconciliation.
create index if not exists msme_invoices_org_idx
  on msme_invoices (org_id);

-- Still-outstanding invoices, which is what almost every read wants.
create index if not exists msme_invoices_open_idx
  on msme_invoices (org_id, vendor_id, invoice_date)
  where payment_date is null;

-- Re-importing the same ledger must update rows, not duplicate them. Scoped to
-- the vendor because invoice numbers are the SUPPLIER's own series and two
-- suppliers commonly both have an "INV-001".
--
-- Deliberately NOT a partial index on `invoice_no is not null`, which is the
-- obvious way to write this and does not work: ON CONFLICT cannot infer a
-- partial index unless the statement repeats its predicate, so the import's
-- upsert fails outright with "no unique or exclusion constraint matching the
-- ON CONFLICT specification".
--
-- It is not needed either. Postgres treats NULLs as distinct in a unique
-- index by default, so invoices with no number never collide with each other
-- and still insert freely — exactly what the partial predicate was for. The
-- consequence is that un-numbered rows cannot be de-duplicated on re-import,
-- which is inherent: without a number there is no key to match them on.
create unique index if not exists msme_invoices_vendor_no_uq
  on msme_invoices (vendor_id, invoice_no);


-- ── The two fields Form MSME-1 asks for that nothing stored ───────────────
alter table msme_declarations
  -- MSME-1 asks the buyer to state why payment is outstanding. It is the
  -- buyer's own text, not the vendor's, so it belongs on the declaration and
  -- is never carried forward — last half-year's reason is not this one's.
  add column if not exists delay_reason text,
  -- "Date from which amount is outstanding". DERIVED from the oldest unpaid
  -- invoice when a ledger exists; this column is the fallback a firm can fill
  -- by hand when it does not. Kept separate from the derivation so importing a
  -- ledger later never silently overwrites something someone typed.
  add column if not exists due_from_date date;


-- RLS: enabled with no policies, i.e. deny-all, matching every other msme_*
-- table. All access is through API routes that have resolved org_id and run
-- the permission gate, using the service-role client.
alter table msme_invoices enable row level security;
