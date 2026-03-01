-- ============================================================
-- FATOURA PRO — Fix 004: Ensure all companies columns exist
-- Run in Supabase SQL Editor if you see "column does not exist"
-- Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── companies: all optional/extra columns ──────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS matricule_fiscal       TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address                 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gouvernorat             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone                   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone2                  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email                   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website                 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tva_regime              TEXT DEFAULT 'reel';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name               TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_rib                TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url                TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix          TEXT DEFAULT 'FP';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_counter         INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_payment_terms   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_fiduciaire           BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS own_cert_pem            TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS own_key_pem             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ttn_username            TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ttn_password            TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at              TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT NOW();

-- current_plan: added by 002_monetization.sql but add here as safety net
-- Must reference plans table (which 002 creates); skip FK if plans doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'current_plan'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans') THEN
      ALTER TABLE companies ADD COLUMN current_plan TEXT DEFAULT 'trialing' REFERENCES plans(id);
    ELSE
      ALTER TABLE companies ADD COLUMN current_plan TEXT DEFAULT 'trialing';
    END IF;
  END IF;
END;
$$;

-- Back-fill NULLs with sensible defaults
UPDATE companies SET tva_regime    = 'reel'     WHERE tva_regime IS NULL;
UPDATE companies SET invoice_prefix = 'FP'       WHERE invoice_prefix IS NULL;
UPDATE companies SET invoice_counter = 0         WHERE invoice_counter IS NULL;
UPDATE companies SET is_fiduciaire  = FALSE      WHERE is_fiduciaire IS NULL;
UPDATE companies SET current_plan   = 'trialing' WHERE current_plan IS NULL;
UPDATE companies SET notification_preferences = '{}' WHERE notification_preferences IS NULL;

-- ── invoices: safety columns ───────────────────────────────
-- The app uses: number, issue_date, due_date, ht_amount, tva_amount,
-- stamp_amount, ttc_amount, total_in_words, ttn_id, ttn_xml,
-- ttn_response (TEXT), ttn_rejection_reason, submitted_at,
-- validated_at, payment_status, paid_at
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS number               TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date           DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date             DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ht_amount            NUMERIC(12,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tva_amount           NUMERIC(12,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stamp_amount         NUMERIC(12,3) DEFAULT 0.600;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ttc_amount           NUMERIC(12,3) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_in_words       TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes                TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ttn_id               TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ttn_xml              TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ttn_response         TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ttn_rejection_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS submitted_at         TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS validated_at         TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at              TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by           UUID REFERENCES auth.users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference            TEXT;

-- ── Ensure payment_status default exists ──────────────────
UPDATE invoices SET payment_status = 'unpaid' WHERE payment_status IS NULL;

-- ============================================================
-- DONE — All columns verified/added
-- ============================================================
