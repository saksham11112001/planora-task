-- Add proof_url column to msme_vendors
-- Stores the URL of the supporting document uploaded for outstanding amount verification

ALTER TABLE msme_vendors
  ADD COLUMN IF NOT EXISTS proof_url TEXT;
