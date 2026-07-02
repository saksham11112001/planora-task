-- Prevent double-spend race on partner withdrawals / payouts.
--
-- Both /api/partner-portal/withdraw and /api/partner/payout do a
-- "check for an existing pending request, then insert" sequence that is NOT
-- atomic. Two concurrent requests can both pass the check and both insert,
-- letting a partner withdraw their commission balance twice.
--
-- A partial unique index makes the DB reject the second concurrent insert with
-- a 23505 unique_violation, which the routes translate into a friendly
-- "you already have a pending request" 409. This is the authoritative guard.

-- Standalone partner portal withdrawals: at most one open request per partner.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_withdrawal_per_partner
  ON standalone_partner_withdrawals (partner_id)
  WHERE status IN ('requested', 'processing');

-- Org-based partner payouts: at most one open payout per partner org.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_payout_per_partner_org
  ON partner_payouts (partner_org_id)
  WHERE status IN ('requested', 'processing');
