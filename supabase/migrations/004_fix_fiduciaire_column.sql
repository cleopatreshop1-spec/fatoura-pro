-- ============================================================
-- FATOURA PRO — Fix missing is_fiduciaire column
-- Run this if you get "column companies.is_fiduciaire does not exist" error
-- ============================================================

-- Add missing is_fiduciaire column if it doesn't exist
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS is_fiduciaire BOOLEAN NOT NULL DEFAULT FALSE;

-- Also ensure other important columns exist
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS own_cert_pem TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS own_key_pem TEXT;

-- Update any existing companies to have the default value
UPDATE companies 
SET is_fiduciaire = FALSE 
WHERE is_fiduciaire IS NULL;

-- ============================================================
-- DONE
-- ============================================================
