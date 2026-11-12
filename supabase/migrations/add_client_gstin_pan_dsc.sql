-- ============================================================================
-- clients: gstin, pan, dsc_holder_name, dsc_expiry_date
--
-- These four columns are written and read all over the app and were never
-- created. Nothing referencing them has ever worked:
--
--   * Saving ANY client failed. app/api/clients/[id] lists all four in
--     ALLOWED and the edit form sends all four, so PostgREST rejected the
--     whole UPDATE with "could not find the 'gstin' column of 'clients' in
--     the schema cache" -- surfaced to the user as "A required database table
--     is missing". Every field on that form, not only the DSC ones.
--
--   * The DSC Expiry page (/clients/dsc-expiry, in the sidebar under CA
--     compliance mode) selects dsc_expiry_date, dsc_holder_name and gstin and
--     orders by dsc_expiry_date. The whole page could never load.
--
--   * Client Health reads dsc_expiry_date to work out days until a signature
--     certificate expires, so that indicator was always blank.
--
-- Types follow how the code uses them: the expiry is compared with
-- `new Date(...)` and sorted on, so a date; the rest are free text.
--
-- All nullable with no default: a client legitimately has no GSTIN (an
-- individual), no DSC, or neither. Nothing is backfilled, because there is no
-- data to backfill -- these values have never been stored anywhere.
--
-- Safe to re-run.
-- ============================================================================

alter table clients add column if not exists gstin            text;
alter table clients add column if not exists pan              text;
alter table clients add column if not exists dsc_holder_name  text;
alter table clients add column if not exists dsc_expiry_date  date;

-- The DSC Expiry page filters out NULLs and orders by the date, per org.
-- Partial, because a firm's clients mostly have no DSC and those rows never
-- take part in that query.
create index if not exists idx_clients_org_dsc_expiry
  on clients (org_id, dsc_expiry_date)
  where dsc_expiry_date is not null;


-- ─────────────────────────────────────────────────────────────────────────────
-- Confirm. All four must read 'exists'.
-- ─────────────────────────────────────────────────────────────────────────────
select
  n.col                                          as column_name,
  case when c.column_name is null then 'MISSING' else 'exists' end as state,
  c.data_type
from (values ('gstin'), ('pan'), ('dsc_holder_name'), ('dsc_expiry_date')) as n(col)
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = 'clients' and c.column_name = n.col
order by n.col;
