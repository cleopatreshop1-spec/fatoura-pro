-- FIX 19: Onboarding tracking columns
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS onboarding_completed       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at    TIMESTAMPTZ DEFAULT NULL;
