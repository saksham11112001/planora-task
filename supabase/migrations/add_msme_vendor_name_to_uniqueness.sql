-- ============================================================================
-- msme_vendors: a vendor is a COMPANY, not an email address
--
-- The current index is:
--   unique (org_id, coalesce(client_id, zero), vendor_email) where not deleted
--
-- so one email can appear only once per client. That is wrong for a common
-- Indian case, and a firm hit it on their first real import: one proprietor
-- owns two supplier companies and both carry the same address.
--
--   Discovery Alcobev Private Limited   harshpanchal143@gmail.com
--   Discovery Sales                     harshpanchal143@gmail.com
--   SGNG & Associates                   info@sgng.in
--   SNG Financial Services              info@sgng.in
--
-- Those are four distinct vendors. Each owes the client a different amount on
-- the same date, so each needs its own MSME declaration -- and the person
-- behind them should receive one request per company, which is exactly what
-- separate rows produce.
--
-- The replacement adds the company name to the key, so the identity of a
-- vendor is (client, company, email). A genuine duplicate -- same company,
-- same email, same client -- is still refused.
--
-- lower(trim(...)) and not the app's normaliseName(): an index expression has
-- to be IMMUTABLE, and more importantly stripping company-form words would
-- merge "X Private Limited" with "X LLP", which are different legal entities
-- that can and do both supply the same client.
--
-- Safe to re-run. The new index is created before the old one is dropped, so
-- there is no window in which duplicates could be inserted.
-- ============================================================================

create unique index if not exists msme_vendors_org_client_email_name_active_uq
  on msme_vendors (
    org_id,
    coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vendor_email,
    lower(trim(vendor_name))
  )
  where is_deleted = false;

drop index if exists msme_vendors_org_client_email_active_uq;


-- ─────────────────────────────────────────────────────────────────────────────
-- Confirm: the new index exists and the old one is gone.
-- ─────────────────────────────────────────────────────────────────────────────
select
  i.indexname,
  case i.indexname
    when 'msme_vendors_org_client_email_name_active_uq' then 'new  -- company + email'
    when 'msme_vendors_org_client_email_active_uq'      then 'OLD  -- should be gone'
    else 'other'
  end as which
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename  = 'msme_vendors'
  and i.indexname like '%email%'
order by i.indexname;
