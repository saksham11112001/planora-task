-- ============================================================================
-- msme_vendors: stop treating a full mailbox as an opt-out
--
-- email_bounced means "never email this address again" -- every send path
-- filters on it. It was being set for SOFT failures too:
--
--   450 4.7.3 Organization queue quota exceeded
--   452-4.2.2 The recipient's inbox is out of storage space
--
-- Those say the mailbox could not accept mail at that moment. The address is
-- correct. Flagging them blocked the vendor permanently, and the MSME screen
-- listed them as "invalid email addresses" to be fixed and re-sent -- a repair
-- that was neither needed nor possible, since the API refuses an address
-- change once mail has been sent.
--
-- The webhook no longer sets the flag for these. This clears the ones already
-- stored, so vendors blocked by a temporary failure become reachable again.
--
-- WHAT IS DELIBERATELY NOT TOUCHED
--   * unsubscribes and spam complaints -- excluded explicitly by wording, and
--     they never carry a 4xx code anyway. An opt-out must survive this.
--   * hard bounces (5xx) -- the address really is wrong; it needs correcting.
--   * anything unrecognisable -- left blocked. Guessing wrong here means
--     mailing dead addresses and damaging the sending domain for every other
--     vendor the firm is chasing.
--
-- Mirrors classifyBounce() in lib/msme/bounceKind.ts. Read-only until you run
-- section 2. Safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PREVIEW -- what section 2 would unblock. Run this first and read it.
-- ─────────────────────────────────────────────────────────────────────────────
with classified as (
  select
    id, org_id, vendor_name, vendor_email, email_count, bounce_reason,
    case
      when lower(bounce_reason) like '%unsubscrib%'
        or lower(bounce_reason) like '%opted out%'
        or lower(bounce_reason) like '%opt-out%'          then 'unsubscribed'
      when lower(bounce_reason) like '%spam%'
        or lower(bounce_reason) like '%complaint%'        then 'spam'
      -- 4xx reply code (450, 452-...) or a bare 4.x.x enhanced code: transient.
      when bounce_reason ~ '^[[:space:]]*4[0-9]{2}(?![0-9.])'
        or bounce_reason ~ '^[[:space:]]*4\.[0-9]{1,3}\.[0-9]{1,3}'  then 'soft'
      -- 5xx is permanent, EXCEPT when it is about storage: 552 "over quota"
      -- is a condition of the mailbox, not of the address.
      when bounce_reason ~ '^[[:space:]]*5[0-9]{2}(?![0-9.])'
       and (lower(bounce_reason) like '%storage%'
         or lower(bounce_reason) like '%quota%')          then 'soft'
      when bounce_reason ~ '^[[:space:]]*5[0-9]{2}(?![0-9.])'
        or bounce_reason ~ '^[[:space:]]*5\.[0-9]{1,3}\.[0-9]{1,3}' then 'hard'
      when lower(bounce_reason) like '%mailbox full%'
        or lower(bounce_reason) like '%out of storage%'
        or lower(bounce_reason) like '%over quota%'
        or lower(bounce_reason) like '%temporarily%'
        or lower(bounce_reason) like '%soft bounce%'       then 'soft'
      when lower(bounce_reason) like '%does not exist%'
        or lower(bounce_reason) like '%no such user%'
        or lower(bounce_reason) like '%user unknown%'
        or lower(bounce_reason) like '%invalid email%'
        or lower(bounce_reason) like '%hard bounce%'       then 'hard'
      else 'unknown'
    end as kind
  from msme_vendors
  where email_bounced = true
)
select
  kind,
  count(*) as vendors,
  case kind
    when 'soft'         then 'UNBLOCKED by section 2 — address was fine all along'
    when 'unsubscribed' then 'left blocked (correct — they opted out)'
    when 'spam'         then 'left blocked (correct — complaint)'
    when 'hard'         then 'left blocked — needs the address corrected'
    else                     'left blocked — reason not recognised'
  end as effect
from classified
group by kind
order by (kind <> 'soft'), kind;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. APPLY. Only rows whose reason is a transient failure.
--    bounce_reason is KEPT, so the screen can still show what happened; the
--    next successful send clears it.
-- ─────────────────────────────────────────────────────────────────────────────
update msme_vendors
set email_bounced = false
where email_bounced = true
  and lower(bounce_reason) not like '%unsubscrib%'
  and lower(bounce_reason) not like '%opted out%'
  and lower(bounce_reason) not like '%opt-out%'
  and lower(bounce_reason) not like '%spam%'
  and lower(bounce_reason) not like '%complaint%'
  and (
        bounce_reason ~ '^[[:space:]]*4[0-9]{2}(?![0-9.])'
     or bounce_reason ~ '^[[:space:]]*4\.[0-9]{1,3}\.[0-9]{1,3}'
     or (bounce_reason ~ '^[[:space:]]*5[0-9]{2}(?![0-9.])'
         and (lower(bounce_reason) like '%storage%'
           or lower(bounce_reason) like '%quota%'))
     or lower(bounce_reason) like '%mailbox full%'
     or lower(bounce_reason) like '%out of storage%'
     or lower(bounce_reason) like '%over quota%'
     or lower(bounce_reason) like '%soft bounce%'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFY. Every row still blocked should be an opt-out, a complaint,
--    a dead address, or genuinely unreadable — never a 4xx.
-- ─────────────────────────────────────────────────────────────────────────────
select
  vendor_name,
  vendor_email,
  bounce_reason,
  case when bounce_reason ~ '^[[:space:]]*4[0-9]{2}(?![0-9.])'
       then 'STILL WRONG — transient failure left blocked'
       else 'ok' end as check
from msme_vendors
where email_bounced = true
order by (bounce_reason ~ '^[[:space:]]*4[0-9]{2}(?![0-9.])') desc, vendor_name;
