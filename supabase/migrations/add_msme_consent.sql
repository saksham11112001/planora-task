-- DPDP Act, 2023 compliance: record when the vendor gave explicit consent on
-- the MSME details form. Written by /api/msme/submit/[token] at submission time.
-- The route writes this best-effort, so applying this migration before OR after
-- deploying the code is safe.
ALTER TABLE msme_vendors ADD COLUMN IF NOT EXISTS consent_at timestamptz;
