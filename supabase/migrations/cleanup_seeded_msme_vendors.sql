-- ============================================================================
-- msme_vendors: soft-delete the seeded demo vendors
--
-- The firm's bounce list is 143 rows, and 129 of them are not real vendors.
-- They were generated: the company name is drawn from a small pool crossed
-- with an industry and a suffix, and the email is built mechanically from the
-- company name --
--
--   Bharat Printers & Sons        bharatprinters.billing@outlook.com
--   Metro Agro Products & Sons    metroagroproducts.info@hotmail.com
--   Ambika Agro Products LLP      accounts@ambikaagroproducts.com
--
-- 43 of those domains have no MX record at all: they were never registered.
-- "Shree Steel Works" appears four times identically.
--
-- WHAT THIS DOES AND DOES NOT DO
--   * Soft delete only: is_deleted = true, which is what the app's own delete
--     does. Nothing is destroyed and it is reversible with one UPDATE.
--   * It does NOT free vendor slots, and must not be expected to. Slots are
--     counted as rows with email_count > 0 INCLUDING deleted ones, so that
--     deleting cannot be used to reclaim paid capacity. Those slots are
--     already spent. Resetting the counters for seeded data is a billing
--     decision for the product owner and is deliberately not done here.
--   * It does NOT touch a vendor who actually responded. Section 3 lists any
--     match holding a declaration and excludes it, because deleting a row
--     with a real submission would destroy evidence the firm may need.
--
-- SAFETY
--   * Two independent conditions must BOTH hold: the row matches the
--     generator's fingerprint, AND it is not on the protect list of known-real
--     businesses. The protect list is belt and braces -- none of those 14
--     match the pattern anyway, so if the pattern is ever widened by accident
--     they are still safe.
--   * Run sections 1-3b and READ THEM before running section 4. Section 2
--     prints every row that would go, by name and address.
--
-- READ SECTION 2. This is not a formality. The rule matches an address SHAPE,
-- and a real supplier who happens to use "company.accounts@gmail.com" looks
-- identical to generated data -- tested with exactly such a row, and the rule
-- claimed it. Nothing here can tell those apart; only someone who knows the
-- firm's suppliers can. If you recognise a single name in section 2, stop and
-- say so rather than running section 4.
--
-- Safe to re-run. Set the org id once, at the top.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. WHICH ORG. Run this first and paste the id into :'org' below.
-- ─────────────────────────────────────────────────────────────────────────────
-- select id, name from organisations order by name;

\set org '00000000-0000-0000-0000-000000000000'   -- <-- REPLACE THIS


-- The matching rule, defined once and reused by every section below so the
-- preview cannot drift from what the delete actually does.
create or replace view _seeded_vendor_review as
with v as (
  select
    id, vendor_name, vendor_email, status, email_count,
    declared_at, submitted_at, is_not_msme, created_at,
    lower(split_part(vendor_email, '@', 1))              as local_part,
    lower(split_part(vendor_email, '@', 2))              as domain,
    regexp_replace(lower(vendor_name), '[^a-z]', '', 'g') as squashed_name
  from msme_vendors
  where is_deleted = false
),
judged as (
  select v.*,
    -- Real businesses, protected by hand. Checked first and unconditionally.
    (domain in ('afbd.co.in','beamsuntory.com','icicilombard.com','timesgroup.com',
                'hrone.cloud','sbigeneral.in','speqtalive.com','saroverhotels.com',
                'submarinepens.co.in','seriff.in','h2oengg-solution.com')
     or vendor_email in ('suryavanshitradingcompany@gmail.com',
                         'svgasengineers2021@gmail.com',
                         'nexusundia3110@gmail.com')) as is_protected,

    -- Fingerprint A: "<companyname>.<department>@<free provider>".
    -- The local part before the dot has to BE the company name, which is what
    -- separates generated data from a real firm that happens to use
    -- accounts@ or sales@.
    (local_part ~ '^[a-z]{6,}\.(billing|accounts|sales|purchase|office|support|admin|info|contact|enquiry)$'
     and squashed_name like left(split_part(local_part, '.', 1), 10) || '%') as matches_dept_pattern,

    -- Fingerprint B: "<department>@<companyname>.com", where the domain is
    -- simply the company name run together.
    (domain ~ '^[a-z][a-z0-9-]{8,}\.com$'
     and squashed_name like left(replace(left(domain, length(domain) - 4), '-', ''), 10) || '%') as matches_domain_pattern,

    -- The three obvious junk rows, named explicitly rather than pattern-matched.
    (vendor_email in ('contact@royalwarehousing.com',
                      'contact@royalwarehousing1.com',
                      'abc@gmail.com')) as is_junk,

    -- A real answer from this vendor. Never deleted automatically.
    (declared_at is not null or submitted_at is not null
     or status in ('submitted', 'not_msme') or is_not_msme = true) as has_declaration
  from v
)
select *,
  case
    when is_protected                                          then 'KEEP — known real business'
    when has_declaration                                       then 'KEEP — holds a declaration, review by hand'
    when is_junk                                               then 'DELETE — junk row'
    when matches_dept_pattern or matches_domain_pattern        then 'DELETE — generator pattern'
    else                                                            'KEEP — did not match'
  end as verdict
from judged;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SUMMARY. Expect roughly: 129 delete, 14 keep-real, 0 keep-declaration.
-- ─────────────────────────────────────────────────────────────────────────────
select verdict, count(*) as vendors
from _seeded_vendor_review
group by verdict
order by (verdict like 'DELETE%') desc, verdict;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EVERY ROW THAT WOULD GO. Read this list before section 4.
--    If you recognise ANY of these as a real supplier, stop and tell me.
-- ─────────────────────────────────────────────────────────────────────────────
select vendor_name, vendor_email, status, email_count, created_at::date as added
from _seeded_vendor_review
where verdict like 'DELETE%'
order by vendor_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MATCHED THE PATTERN BUT HOLDS A DECLARATION. Not deleted by section 4.
--    Should be empty. Anything here needs a human decision.
-- ─────────────────────────────────────────────────────────────────────────────
select vendor_name, vendor_email, status, declared_at, submitted_at
from _seeded_vendor_review
where verdict = 'KEEP — holds a declaration, review by hand'
order by vendor_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. LEFT BEHIND. Rows the rule did not claim, so you can see what it missed
--     rather than discovering it later in the vendor list.
--
--     The domain test needs 9+ characters before ".com", which keeps a short
--     one like "srifoods.com" even though it looks seeded. That threshold is
--     deliberately cautious: leaving a seeded row behind costs a line in a
--     list, deleting a real supplier costs a declaration. Delete anything here
--     by hand if you agree it is seeded.
-- ─────────────────────────────────────────────────────────────────────────────
select vendor_name, vendor_email, status, email_count
from _seeded_vendor_review
where verdict = 'KEEP — did not match'
order by vendor_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. APPLY. Only after sections 1-3 look right.
--    Soft delete, scoped to the one org. Reversible — section 6 shows how.
-- ─────────────────────────────────────────────────────────────────────────────
-- The exact ids are recorded BEFORE the delete, and the undo reads that log
-- rather than re-deriving the rule.
--
-- Two reasons. The review view filters is_deleted = false, so a soft-deleted
-- row drops out of it and a rule-based undo would match nothing at all -- the
-- first version of this file had exactly that bug and silently restored zero
-- rows. And if the rule were edited between the delete and the undo, a
-- rule-based undo would restore a different set than the one it took.
create table if not exists _seeded_vendor_cleanup_log (
  id         uuid primary key,
  deleted_at timestamptz not null default now()
);

with target as (
  select v.id
  from msme_vendors v
  join _seeded_vendor_review r on r.id = v.id
  where v.org_id = :'org'::uuid
    and v.is_deleted = false
    and r.verdict like 'DELETE%'
), logged as (
  insert into _seeded_vendor_cleanup_log (id)
  select id from target
  on conflict (id) do nothing
  returning id
)
update msme_vendors
set is_deleted = true
where id in (select id from target);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFY. What is left active, and the bounce list the firm now sees.
-- ─────────────────────────────────────────────────────────────────────────────
select
  count(*)                                              as active_vendors,
  count(*) filter (where email_bounced)                 as still_blocked,
  count(*) filter (where bounce_reason is not null)     as with_any_delivery_problem
from msme_vendors
where org_id = :'org'::uuid and is_deleted = false;

select vendor_name, vendor_email, bounce_reason
from msme_vendors
where org_id = :'org'::uuid and is_deleted = false and email_bounced
order by vendor_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. UNDO, if section 2 turns out to have contained something real.
--    Restores exactly the rows section 4 took, from the log it wrote.
--    Uncomment and run. Verified to restore all of them.
-- ─────────────────────────────────────────────────────────────────────────────
-- update msme_vendors set is_deleted = false
-- where id in (select id from _seeded_vendor_cleanup_log);

-- To put back ONE vendor you recognise, without undoing the rest:
-- update msme_vendors set is_deleted = false where vendor_email = 'them@example.com';

-- Tidy up once you are satisfied. Keep the log until then — dropping it is
-- what makes the delete irreversible.
-- drop view _seeded_vendor_review;
-- drop table _seeded_vendor_cleanup_log;
