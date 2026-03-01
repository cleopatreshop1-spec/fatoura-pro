-- ============================================================
-- FATOURA PRO — 005: Complete schema fix
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE / ON CONFLICT)
-- Run this in Supabase SQL Editor to bring any existing DB up to date
-- ============================================================

-- ── companies: ensure all columns exist ────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS matricule_fiscal         TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address                  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS gouvernorat              TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code              TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone                    TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone2                   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email                    TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website                  TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tva_regime               TEXT DEFAULT 'reel';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name                TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_rib                 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url                 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_prefix           TEXT DEFAULT 'FP';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_counter          INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_payment_terms    TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_fiduciaire            BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS own_cert_pem             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS own_key_pem              TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ttn_username             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ttn_password             TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS current_plan             TEXT DEFAULT 'trialing';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at               TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT NOW();

-- ── clients: ensure all columns exist ──────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS matricule_fiscal TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address          TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gouvernorat      TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code      TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bank_name        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bank_rib         TEXT;

-- ── invoice_line_items: drop generated columns, recreate as plain ──
-- line_ht/line_tva/line_ttc may have been created as GENERATED ALWAYS columns
-- which block explicit inserts. Drop and recreate as regular columns.
ALTER TABLE invoice_line_items DROP COLUMN IF EXISTS line_ht;
ALTER TABLE invoice_line_items DROP COLUMN IF EXISTS line_tva;
ALTER TABLE invoice_line_items DROP COLUMN IF EXISTS line_ttc;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS line_ht   NUMERIC(12,3) NOT NULL DEFAULT 0;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS line_tva  NUMERIC(12,3) NOT NULL DEFAULT 0;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS line_ttc  NUMERIC(12,3) NOT NULL DEFAULT 0;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- ── invoices: ensure all columns exist ─────────────────────
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
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status       TEXT DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','partial','paid'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at              TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by           UUID REFERENCES auth.users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference            TEXT;

-- ── plans catalog: upsert all plans ────────────────────────
INSERT INTO plans (id, name, price_monthly, price_yearly, invoice_limit, user_limit, client_limit, features)
VALUES
  ('trialing',   'Essai gratuit', 0,       0,        20,   1,    NULL, '{"ttn":true,"pdf":true,"tva":true}'),
  ('starter',    'Starter',       29.000,  295.000,  50,   1,    NULL, '{"ttn":true,"pdf":true,"tva":true,"support":"email"}'),
  ('pro',        'Pro',           79.000,  805.000,  NULL, 3,    NULL, '{"ttn":true,"pdf":true,"tva":true,"mandate":true,"financing":true,"erp_import":true,"support":"priority"}'),
  ('fiduciaire', 'Fiduciaire',    199.000, 2030.000, NULL, NULL, 50,   '{"ttn":true,"pdf":true,"tva":true,"mandate":true,"financing":true,"erp_import":true,"multi_clients":true,"support":"account_manager"}'),
  ('enterprise', 'Enterprise',    0,       0,        NULL, NULL, NULL, '{"ttn":true,"pdf":true,"tva":true,"mandate":true,"financing":true,"erp_import":true,"multi_clients":true,"api":true,"sla":"99.9","support":"dedicated"}')
ON CONFLICT (id) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  features      = EXCLUDED.features;

-- ── back-fill NULLs with sensible defaults ──────────────────
UPDATE companies SET tva_regime             = 'reel'     WHERE tva_regime IS NULL;
UPDATE companies SET invoice_prefix         = 'FP'       WHERE invoice_prefix IS NULL;
UPDATE companies SET invoice_counter        = 0          WHERE invoice_counter IS NULL;
UPDATE companies SET is_fiduciaire          = FALSE      WHERE is_fiduciaire IS NULL;
UPDATE companies SET current_plan           = 'trialing' WHERE current_plan IS NULL;
UPDATE companies SET notification_preferences = '{}'     WHERE notification_preferences IS NULL;
UPDATE invoices  SET payment_status         = 'unpaid'   WHERE payment_status IS NULL;

-- ── auto-create missing subscriptions ──────────────────────
INSERT INTO subscriptions (company_id, plan_id, status)
SELECT id, 'trialing', 'trialing' FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- ── updated_at trigger on clients (may be missing) ─────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['companies','clients','invoices'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
       CREATE TRIGGER trg_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── realtime publications ───────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── reload PostgREST schema cache ───────────────────────────
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE — all schema fixes applied
-- ============================================================
