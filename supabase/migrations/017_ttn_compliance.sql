-- Migration 017: TTN/ElFatoora compliance tables and columns
-- Per: Guide Adhésion TTN 2025 + Politique Signature v2.0

-- ─── ttn_submissions: Full audit trail of every submission ───────────────────
CREATE TABLE IF NOT EXISTS ttn_submissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID        REFERENCES invoices(id) ON DELETE CASCADE,
  company_id        UUID        REFERENCES companies(id) ON DELETE CASCADE,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  ttn_reference     VARCHAR(100),
  ttn_status        VARCHAR(50),   -- 'accepted' | 'rejected' | 'pending'
  ttn_response      JSONB,
  signed_xml        TEXT,
  error_message     TEXT,
  retry_count       INTEGER     DEFAULT 0,
  signing_mode      VARCHAR(20) DEFAULT 'mandate',  -- 'mandate' | 'own_certificate'
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ttn_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ttn_submissions' AND policyname = 'company_access'
  ) THEN
    CREATE POLICY "company_access" ON ttn_submissions
      USING (
        company_id IN (
          SELECT id FROM companies WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── companies: TTN registration columns ─────────────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_connection_mode       VARCHAR(20)  DEFAULT 'webservice';
  -- 'webservice' | 'sftp'

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_ip_address            VARCHAR(50);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_registered_signers    JSONB;
  -- [{email, cert_serial, name}]

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  has_own_certificate       BOOLEAN      DEFAULT FALSE;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  own_certificate_encrypted TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_subscription_status   VARCHAR(30)  DEFAULT 'not_registered';
  -- 'not_registered' | 'dossier_submitted' | 'in_test' | 'production'

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_sftp_host             VARCHAR(200);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_sftp_port             INTEGER      DEFAULT 22;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_sftp_user_encrypted   TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  ttn_sftp_pass_encrypted   TEXT;

-- ─── invoices: payment_date column (app uses this, DB only had paid_at) ───────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  payment_date    DATE;

-- Back-fill from paid_at where available
UPDATE invoices SET payment_date = paid_at::DATE
  WHERE paid_at IS NOT NULL AND payment_date IS NULL;

-- ─── invoices: TTN reference columns ─────────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  ttn_reference   VARCHAR(100);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  ttn_signed_at   TIMESTAMPTZ;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ttn_submissions_company   ON ttn_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_ttn_submissions_invoice   ON ttn_submissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ttn_submissions_status    ON ttn_submissions(ttn_status);
