-- Track whether a user has completed/dismissed the product walkthrough.
-- NULL = never seen, timestamp = completed at that moment (any device).
ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;
