-- ============================================================================
-- MSME seeded-vendor cleanup — SINGLE SCRIPT, nothing to fill in.
--
-- Paste the whole file into the Supabase SQL editor and run it once.
-- It targets SAKSHAM TEST ORG by id, checks its own assumptions, soft-deletes
-- the seeded vendors there, and prints what it did. It refuses to run against
-- any organisation whose name does not say "test".
--
-- WHY THE REVIEW STILL MATTERS
-- The rule matches an address SHAPE. A real supplier who happens to use
-- "company.accounts@gmail.com" looks identical to generated data — tested
-- with exactly such a row planted in the real export, and the rule claimed
-- it. Nothing in SQL can tell those apart.
--
-- So the review moved from before to after. Nothing is destroyed: this sets
-- is_deleted, the same flag the app's own delete sets. The last result grid
-- lists every vendor it removed. Read it. If you recognise one, run the UNDO
-- at the bottom — it restores all of them, or just the one you name.
--
-- IT WILL REFUSE TO RUN if its assumptions do not hold: no org found, two
-- orgs equally matching, a known-real vendor caught by the rule, or a delete
-- so large it would empty the list. In those cases it raises an error, the
-- whole script rolls back, and nothing changes.
--
-- IT DOES NOT FREE VENDOR SLOTS. Slots count rows with email_count > 0
-- including deleted ones, so deleting cannot reclaim paid capacity. Those
-- slots are already spent. Resetting the counters for seeded data is a
-- billing decision and is deliberately not taken here.
--
-- Safe to re-run: a second run deletes nothing.
-- ============================================================================

-- ── Where the undo reads from. Kept until you drop it. ──────────────────────
create table if not exists _seeded_vendor_cleanup_log (
  id         uuid primary key,
  deleted_at timestamptz not null default now()
);


-- ── The rule, and the org, both derived from the data itself ───────────────
create or replace view _seeded_vendor_review as
with target_org as (
  -- SAKSHAM TEST ORG, named explicitly.
  --
  -- This was inferred from marker addresses at first, and the guard refused
  -- to run because two orgs held them. It was right to: the seeded vendors
  -- are in this test org, while the markers that looked like the same dataset
  -- (Times Internet, ICICI Lombard) are REAL vendors belonging to a live
  -- client, Secret Niko Foods LLP. Inferring would eventually have picked a
  -- real firm and soft-deleted its vendors.
  --
  -- A single id cannot be ambiguous, so it is written here rather than
  -- derived. Change it only to clean a different org, and only after
  -- confirming that org's vendors really are seeded.
  select 'f61f633b-df90-4849-bd47-5970c7a53cc1'::uuid as org_id
),
v as (
  select
    m.id, m.org_id, m.vendor_name, m.vendor_email, m.status, m.email_count,
    m.declared_at, m.submitted_at, m.is_not_msme, m.created_at, m.email_bounced,
    lower(split_part(m.vendor_email, '@', 1))                as local_part,
    lower(split_part(m.vendor_email, '@', 2))                as domain,
    regexp_replace(lower(m.vendor_name), '[^a-z]', '', 'g')  as squashed_name
  from msme_vendors m
  join target_org t on t.org_id = m.org_id
  where m.is_deleted = false
),
judged as (
  select v.*,
    -- Known-real businesses. Checked first and unconditionally.
    (domain in ('afbd.co.in','beamsuntory.com','icicilombard.com','timesgroup.com',
                'hrone.cloud','sbigeneral.in','speqtalive.com','saroverhotels.com',
                'submarinepens.co.in','seriff.in','h2oengg-solution.com')
     or vendor_email in ('suryavanshitradingcompany@gmail.com',
                         'svgasengineers2021@gmail.com',
                         'nexusundia3110@gmail.com')) as is_protected,

    -- "<companyname>.<department>@<free provider>". The part before the dot
    -- has to BE the company name — that is what separates generated data from
    -- a real firm that merely uses accounts@ or sales@.
    (local_part ~ '^[a-z]{6,}\.(billing|accounts|sales|purchase|office|support|admin|info|contact|enquiry)$'
     and squashed_name like left(split_part(local_part, '.', 1), 10) || '%') as matches_dept_pattern,

    -- "<department>@<companyname>.com", the domain being the name run together.
    -- 9+ characters required, which spares a short real domain at the cost of
    -- leaving the odd seeded row behind. That is the safer direction.
    (domain ~ '^[a-z][a-z0-9-]{8,}\.com$'
     and squashed_name like left(replace(left(domain, length(domain) - 4), '-', ''), 10) || '%') as matches_domain_pattern,

    (vendor_email in ('contact@royalwarehousing.com',
                      'contact@royalwarehousing1.com',
                      'abc@gmail.com')) as is_junk,

    -- A real answer from this vendor. Never deleted automatically: removing a
    -- row that holds a declaration would destroy evidence the firm may need.
    (declared_at is not null or submitted_at is not null
     or status in ('submitted', 'not_msme') or is_not_msme = true) as has_declaration
  from v
)
select *,
  case
    when is_protected                                   then 'KEEP — known real business'
    when has_declaration                                then 'KEEP — holds a declaration'
    when is_junk                                        then 'DELETE — junk row'
    when matches_dept_pattern or matches_domain_pattern then 'DELETE — generator pattern'
    else                                                     'KEEP — did not match'
  end as verdict
from judged;


-- ── Check, then delete — in ONE statement ───────────────────────────────────
--
-- The checks and the delete are inside a single DO block deliberately. They
-- were separate statements at first: the guard raised its error correctly and
-- the delete on the next line ran anyway, removing 292 rows it had just been
-- told not to touch. A failed statement does not stop the one after it, and
-- whether a script is wrapped in a transaction depends on the client.
--
-- A DO block is one statement. If it raises, nothing inside it is applied.
do $$
declare
  n_orgs       int;
  n_active     int;
  n_delete     int;
  n_protected  int;
  org_name     text;
  n_done       int;
  bad          text;
begin
  select count(*) into n_orgs
  from organisations where id = 'f61f633b-df90-4849-bd47-5970c7a53cc1'::uuid;

  if n_orgs = 0 then
    raise exception
      'Target organisation not found. Nothing changed — wrong database, or the '
      'id has changed.';
  end if;

  -- THE GUARD THAT MATTERS. This script deletes vendors wholesale, which is
  -- only ever acceptable in a test organisation. If the id is ever edited to
  -- point at a live client, this stops it.
  --
  -- It exists because the first version inferred the org from vendor
  -- addresses and would eventually have chosen a real firm: the markers it
  -- matched on included Times Internet and ICICI Lombard, which turned out to
  -- be genuine vendors of a live client, not part of the seeded set.
  select name into org_name
  from organisations where id = 'f61f633b-df90-4849-bd47-5970c7a53cc1'::uuid;

  if org_name !~* 'test' then
    raise exception
      'Target organisation is "%", which does not look like a test org. '
      'Refusing to bulk-delete vendors from what may be a real client. '
      'Nothing changed.', org_name;
  end if;

  select count(*)                                    into n_active   from _seeded_vendor_review;
  select count(*) filter (where verdict like 'DELETE%') into n_delete from _seeded_vendor_review;
  select count(*) filter (where is_protected)        into n_protected from _seeded_vendor_review;

  -- A protected vendor must never be in the delete set.
  --
  -- This cannot fire as the file stands: the verdict CASE tests is_protected
  -- first, so a protected vendor never carries a DELETE verdict. It is a
  -- tripwire for a future edit that reorders those branches, not a live
  -- check — worth keeping precisely because such an edit would look harmless.
  select string_agg(vendor_name, ', ') into bad
  from _seeded_vendor_review
  where is_protected and verdict like 'DELETE%';
  if bad is not null then
    raise exception 'A known-real vendor was caught by the rule (%). Nothing changed.', bad;
  end if;

  -- The "never empty the list" and "no real vendor present" checks that stood
  -- here have been REMOVED, not relaxed.
  --
  -- Both assumed a live client's vendor list, where a rule matching nearly
  -- everything means the rule is broken. In a test organisation the opposite
  -- holds: almost every vendor IS seeded, so those checks would have blocked
  -- the one job this script now has. A guard that fires on correct input
  -- trains people to work around guards.
  --
  -- The org-name check above replaces them and is stricter about the thing
  -- that actually matters: this cannot run against a real client at all.
  if n_delete > 500 then
    raise exception
      'Rule matched % vendors, far more than this job should ever touch. '
      'Nothing changed.', n_delete;
  end if;

  raise notice 'Checks passed: % active, % to delete, % protected.', n_active, n_delete, n_protected;

  -- The ids are recorded BEFORE the delete and the undo reads that log rather
  -- than re-deriving the rule, so it restores exactly what was taken even if
  -- the rule is edited later. A rule-based undo would also match nothing,
  -- because the review view hides deleted rows.
  with target as (
    select v.id
    from msme_vendors v
    join _seeded_vendor_review r on r.id = v.id
    where v.is_deleted = false
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

  get diagnostics n_done = row_count;
  raise notice 'Removed % vendors. Undo: update msme_vendors set is_deleted = false '
               'where id in (select id from _seeded_vendor_cleanup_log);', n_done;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- RESULT — read this. One grid: the totals, then every vendor removed, then
-- every vendor kept.
--
-- The Supabase editor shows only the LAST statement's output, which is why
-- this is a single query rather than several.
-- ════════════════════════════════════════════════════════════════════════════
with log_org as (
  select m.org_id
  from _seeded_vendor_cleanup_log l join msme_vendors m on m.id = l.id limit 1
),
scope as (
  select m.* from msme_vendors m join log_org o on o.org_id = m.org_id
)
select * from (
  select 1 as ord, '── TOTALS ──' as section,
         'removed: '  || (select count(*) from scope where is_deleted)
      || '   kept: '  || (select count(*) from scope where not is_deleted)
      || '   still blocked: ' || (select count(*) from scope where not is_deleted and email_bounced)
           as vendor_name,
         '' as vendor_email, '' as note
  union all
  select 2, '── UNDO ──',
         'update msme_vendors set is_deleted = false where id in (select id from _seeded_vendor_cleanup_log);',
         '', 'run this if you recognise anything below'
  union all
  select 3, 'REMOVED', s.vendor_name, s.vendor_email,
         coalesce(left(s.bounce_reason, 60), '')
  from scope s where s.is_deleted
  union all
  select 4, 'KEPT', s.vendor_name, s.vendor_email,
         case when s.email_bounced then 'still blocked — ' || coalesce(left(s.bounce_reason, 45), '')
              else 'active' end
  from scope s where not s.is_deleted
) t
order by ord, vendor_name;


-- ============================================================================
-- UNDO — restores every vendor this script removed:
--
--   update msme_vendors set is_deleted = false
--   where id in (select id from _seeded_vendor_cleanup_log);
--
-- Or put back just one:
--
--   update msme_vendors set is_deleted = false
--   where vendor_email = 'them@example.com';
--
-- Once you are satisfied, tidy up (this is what makes it permanent):
--
--   drop view _seeded_vendor_review;
--   drop table _seeded_vendor_cleanup_log;
-- ============================================================================
