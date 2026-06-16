-- Standalone partner accounts — independent of Planora orgs/users.
-- A person can become a partner without being a Planora user.
CREATE TABLE IF NOT EXISTS standalone_partners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  phone         text,
  referral_code text        NOT NULL UNIQUE,
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  referred_by   text,       -- referral_code of the partner who invited this one
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standalone_partners_user    ON standalone_partners(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_standalone_partners_refcode ON standalone_partners(referral_code);

-- Invites sent from the partner portal
CREATE TABLE IF NOT EXISTS partner_portal_invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid        NOT NULL REFERENCES standalone_partners(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  invite_type  text        NOT NULL CHECK (invite_type IN ('msme', 'partner')),
  invite_count int         NOT NULL DEFAULT 1,
  last_sent_at timestamptz DEFAULT now(),
  signed_up    boolean     DEFAULT false,
  signed_up_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (partner_id, email, invite_type)
);

CREATE INDEX IF NOT EXISTS idx_partner_portal_invites_partner ON partner_portal_invites(partner_id);
