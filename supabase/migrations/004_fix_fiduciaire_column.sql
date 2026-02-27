-- ============================================================
-- FATOURA PRO — Fix missing columns in companies table
-- Run this if you get "column does not exist" errors
-- ============================================================

-- Add all missing columns that should exist in companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS matricule_fiscal TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS gouvernorat TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS phone2 TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS tva_regime TEXT NOT NULL DEFAULT 'reel';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bank_name TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bank_rib TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'FP';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS invoice_counter INTEGER NOT NULL DEFAULT 0;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS default_payment_terms TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS is_fiduciaire BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS own_cert_pem TEXT;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS own_key_pem TEXT;

-- Add the current_plan column from monetization
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'trialing';

-- Add constraints for tva_regime if they don't exist
ALTER TABLE companies
  ADD CONSTRAINT IF NOT EXISTS companies_tva_regime_check 
  CHECK (tva_regime IN ('reel','forfait','exonere'));

-- Update any existing companies to have proper default values
UPDATE companies 
SET matricule_fiscal = NULL 
WHERE matricule_fiscal IS NULL;

UPDATE companies 
SET address = NULL 
WHERE address IS NULL;

UPDATE companies 
SET gouvernorat = NULL 
WHERE gouvernorat IS NULL;

UPDATE companies 
SET postal_code = NULL 
WHERE postal_code IS NULL;

UPDATE companies 
SET phone = NULL 
WHERE phone IS NULL;

UPDATE companies 
SET phone2 = NULL 
WHERE phone2 IS NULL;

UPDATE companies 
SET email = NULL 
WHERE email IS NULL;

UPDATE companies 
SET website = NULL 
WHERE website IS NULL;

UPDATE companies 
SET tva_regime = 'reel' 
WHERE tva_regime IS NULL;

UPDATE companies 
SET bank_name = NULL 
WHERE bank_name IS NULL;

UPDATE companies 
SET bank_rib = NULL 
WHERE bank_rib IS NULL;

UPDATE companies 
SET logo_url = NULL 
WHERE logo_url IS NULL;

UPDATE companies 
SET invoice_prefix = 'FP' 
WHERE invoice_prefix IS NULL;

UPDATE companies 
SET invoice_counter = 0 
WHERE invoice_counter IS NULL;

UPDATE companies 
SET default_payment_terms = NULL 
WHERE default_payment_terms IS NULL;

UPDATE companies 
SET notification_preferences = '{}' 
WHERE notification_preferences IS NULL;

UPDATE companies 
SET is_fiduciaire = FALSE 
WHERE is_fiduciaire IS NULL;

UPDATE companies 
SET own_cert_pem = NULL 
WHERE own_cert_pem IS NULL;

UPDATE companies 
SET own_key_pem = NULL 
WHERE own_key_pem IS NULL;

UPDATE companies 
SET current_plan = 'trialing' 
WHERE current_plan IS NULL;

-- ============================================================
-- DONE
-- ============================================================
