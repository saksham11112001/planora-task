-- Track Brevo bounce events on MSME vendors.
-- email_bounced: set true when Brevo reports hard_bounce / soft_bounce / spam.
-- bounce_reason: human-readable reason from Brevo.
-- Email count is NOT touched — the slot is already consumed; this is purely informational.
ALTER TABLE msme_vendors
  ADD COLUMN IF NOT EXISTS email_bounced boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bounce_reason text;
