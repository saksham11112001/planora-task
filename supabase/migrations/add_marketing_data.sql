-- Add marketing_data JSONB column to organisations for onboarding survey responses
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS marketing_data JSONB;
