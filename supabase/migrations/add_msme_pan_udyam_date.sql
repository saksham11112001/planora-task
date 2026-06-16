-- Add PAN and Udyam registration date to msme_vendors.
-- PAN: cross-verifies vendor identity during audit (as per MSMED Act).
-- udyam_registered_on: date from Udyam certificate — used to flag vendors
--   whose enterprise classification may need re-verification if their
--   turnover/investment thresholds have changed since initial registration.
ALTER TABLE msme_vendors
  ADD COLUMN IF NOT EXISTS pan                text,
  ADD COLUMN IF NOT EXISTS udyam_registered_on date;
