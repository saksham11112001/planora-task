-- Scope MSME vendors to a client.
--
-- WHY
-- ---
-- Form MSME-1 is filed BY a company, about ITS suppliers. A CA firm files it
-- on behalf of many client companies, each with its own supplier list and its
-- own return.
--
-- msme_vendors was scoped to org_id alone, so every vendor belonged to the
-- FIRM. A firm serving 30 companies had one undifferentiated vendor list and
-- no way to produce a per-company return — the only workaround was a separate
-- upFloat organisation per client, which splits billing, members and every
-- other module too.
--
-- client_id is NULLABLE and defaults to null, so nothing changes for an
-- existing user until they start assigning vendors. A null client_id means
-- "held at firm level", which is exactly what every existing row is.

alter table msme_vendors
  add column if not exists client_id uuid references clients(id) on delete set null;

-- The list is almost always read for one client at a time.
create index if not exists msme_vendors_org_client_idx
  on msme_vendors (org_id, client_id)
  where is_deleted = false;


-- ── Uniqueness has to change ──────────────────────────────────────────────
--
-- The old index was:
--   unique (org_id, vendor_email) where is_deleted = false
--
-- which forbids one vendor email appearing twice in a firm. That is wrong
-- once vendors belong to clients: the SAME supplier commonly supplies several
-- of a firm's client companies, and each of those needs its own declaration,
-- because each company owes it a different amount on the same date.
--
-- The replacement keys on the client as well. coalesce to an all-zero UUID
-- rather than indexing client_id directly, because Postgres treats NULLs as
-- distinct in a unique index by default — so a plain (org_id, client_id,
-- vendor_email) index would allow unlimited duplicate firm-level rows and
-- silently drop today's guarantee. (UNIQUE NULLS NOT DISTINCT would also work
-- but needs Postgres 15+; this works everywhere.)
--
-- gen_random_uuid() cannot produce the all-zero UUID, so it can never collide
-- with a real client id.
create unique index if not exists msme_vendors_org_client_email_active_uq
  on msme_vendors (
    org_id,
    coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vendor_email
  )
  where is_deleted = false;

-- Dropped only after the replacement exists, so there is no window in which
-- duplicates could be inserted.
drop index if exists msme_vendors_org_email_active_uq;


-- ── Note on the slot ledger ───────────────────────────────────────────────
--
-- Slots are counted per ROW (msme_vendors rows with email_count > 0), and that
-- is left unchanged. So the same supplier contacted for three client companies
-- consumes three slots. That matches the work done — three declarations
-- collected for three separate statutory returns — but it is a PRICING
-- decision, not a technical one. Changing it means counting distinct
-- vendor_email per org instead, in the three places that read the ledger.
