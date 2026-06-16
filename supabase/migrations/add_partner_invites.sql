-- Partner direct email invites (MSME Tracker)
-- Tracks direct invite emails sent by a partner to specific email addresses.
-- When the invited person signs up via the referral link, the existing
-- referral_redemptions flow captures them; this table just tracks who was contacted.

CREATE TABLE IF NOT EXISTS partner_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email            text NOT NULL,
  invite_count     int  NOT NULL DEFAULT 1,
  last_sent_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_partner_invites_org ON partner_invites(referrer_org_id);
