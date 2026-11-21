-- ============================================================================
-- WHICH PRODUCT IS THIS?  --  READ ONLY, changes nothing.
--
-- upfloat.co sells "practice management for Indian CA firms". But of the live
-- organisations, SGNG & Associates is a CA firm while Secret Niko Foods,
-- BOMBA FOOD and Secret Ingredient Projects look like companies using the
-- MSME declaration module — a different buyer, a different pain, and a
-- different place to find them.
--
-- That is a marketing decision resting on an assumption, and the assumption
-- is checkable. This counts what each organisation actually DOES: how many
-- compliance tasks it runs, how many vendors it chases, when it last did
-- anything at all.
--
-- HOW TO READ IT
--   ca_tasks high, msme_vendors zero   -> a CA practice. Sell practice mgmt.
--   msme_vendors high, ca_tasks zero   -> an MSME compliance user. Different
--                                         product, different channel.
--   both near zero but members > 1     -> signed up, never started. These are
--                                         the five phone calls worth making.
--   last_activity months ago           -> churned, whatever the plan says.
--
-- `is not true` rather than `= false` throughout: these flags are nullable,
-- and `NULL = false` is NULL, so the simpler form silently drops every row
-- where the column was never set.
-- ============================================================================

select
  o.name                                   as organisation,
  o.plan_tier                              as plan,
  o.created_at::date                       as signed_up,

  (select count(*) from org_members m
    where m.org_id = o.id)                 as members,

  (select count(*) from clients c
    where c.org_id = o.id
      and c.is_archived is not true)       as clients,

  -- Total work in the system, and how much of it is statutory compliance.
  (select count(*) from tasks t
    where t.org_id = o.id
      and t.is_archived is not true)       as tasks,

  (select count(*) from tasks t
    where t.org_id = o.id
      and t.is_archived is not true
      and t.custom_fields @> '{"_ca_compliance": true}')  as ca_tasks,

  -- The MSME side.
  (select count(*) from msme_vendors v
    where v.org_id = o.id
      and v.is_deleted = false)            as msme_vendors,

  (select count(*) from msme_vendors v
    where v.org_id = o.id
      and v.is_deleted = false
      and v.email_count > 0)               as msme_chased,

  (select count(*) from msme_vendors v
    where v.org_id = o.id
      and v.is_deleted = false
      and v.submitted_at is not null)      as msme_answered,

  -- The honest health check. A plan tier says what they bought; this says
  -- whether they are still here.
  greatest(
    coalesce((select max(t.created_at) from tasks t where t.org_id = o.id), 'epoch'),
    coalesce((select max(v.created_at) from msme_vendors v where v.org_id = o.id), 'epoch'),
    coalesce((select max(c.created_at) from clients c where c.org_id = o.id), 'epoch')
  )::date                                  as last_activity,

  case
    when o.name ilike '%test%' then 'test org — ignore'
    when (select count(*) from tasks t where t.org_id = o.id
            and t.custom_fields @> '{"_ca_compliance": true}') > 0
      then 'CA PRACTICE'
    when (select count(*) from msme_vendors v where v.org_id = o.id
            and v.is_deleted = false and v.email_count > 0) > 0
      then 'MSME COMPLIANCE'
    when (select count(*) from tasks t where t.org_id = o.id) > 0
      then 'general task use'
    else 'never started'
  end                                      as verdict

from organisations o
order by
  (o.name ilike '%test%'),          -- test orgs last
  greatest(
    coalesce((select max(t.created_at) from tasks t where t.org_id = o.id), 'epoch'),
    coalesce((select max(v.created_at) from msme_vendors v where v.org_id = o.id), 'epoch')
  ) desc;
