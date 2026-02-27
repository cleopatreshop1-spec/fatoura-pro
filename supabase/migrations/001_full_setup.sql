-- ============================================================
-- FATOURA PRO  Complete Supabase Setup
-- Paste the entire file into Supabase SQL Editor and click RUN
-- IMPORTANT: run ONCE on a fresh database.
-- ============================================================

-- 
-- STEP 1  CREATE ALL TABLES (no cross-ref policies yet)
-- 

-- 1. companies
CREATE TABLE IF NOT EXISTS companies (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  matricule_fiscal         TEXT,
  address                  TEXT,
  gouvernorat              TEXT,
  postal_code              TEXT,
  phone                    TEXT,
  phone2                   TEXT,
  email                    TEXT,
  website                  TEXT,
  tva_regime               TEXT NOT NULL DEFAULT 'reel'
                             CHECK (tva_regime IN ('reel','forfait','exonere')),
  bank_name                TEXT,
  bank_rib                 TEXT,
  logo_url                 TEXT,
  invoice_prefix           TEXT NOT NULL DEFAULT 'FP',
  invoice_counter          INTEGER NOT NULL DEFAULT 0,
  default_payment_terms    TEXT,
  notification_preferences JSONB NOT NULL DEFAULT '{}',
  plan                     TEXT NOT NULL DEFAULT 'free',
  is_fiduciaire            BOOLEAN NOT NULL DEFAULT FALSE,
  own_cert_pem             TEXT,
  own_key_pem              TEXT
);

-- 2. clients
CREATE TABLE IF NOT EXISTS clients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'B2B' CHECK (type IN ('B2B','B2C')),
  matricule_fiscal TEXT,
  address          TEXT,
  gouvernorat      TEXT,
  postal_code      TEXT,
  phone            TEXT,
  email            TEXT,
  bank_name        TEXT,
  bank_rib         TEXT
);

-- 3. invoices
CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES clients(id) ON DELETE SET NULL,
  number               TEXT,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','queued','pending','valid','rejected')),
  issue_date           DATE,
  due_date             DATE,
  ht_amount            NUMERIC(12,3) NOT NULL DEFAULT 0,
  tva_amount           NUMERIC(12,3) NOT NULL DEFAULT 0,
  stamp_amount         NUMERIC(12,3) NOT NULL DEFAULT 0.600,
  ttc_amount           NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_in_words       TEXT,
  notes                TEXT,
  ttn_id               TEXT,
  ttn_xml              TEXT,
  ttn_response         TEXT,
  ttn_rejection_reason TEXT,
  submitted_at         TIMESTAMPTZ,
  validated_at         TIMESTAMPTZ,
  payment_status       TEXT NOT NULL DEFAULT 'unpaid'
                         CHECK (payment_status IN ('unpaid','partial','paid')),
  paid_at              TIMESTAMPTZ,
  created_by           UUID REFERENCES auth.users(id)
);

-- 4. invoice_line_items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,3) NOT NULL DEFAULT 0,
  tva_rate    NUMERIC(4,1)  NOT NULL DEFAULT 19
                CHECK (tva_rate IN (0, 7, 13, 19)),
  line_ht     NUMERIC(12,3) NOT NULL DEFAULT 0,
  line_tva    NUMERIC(12,3) NOT NULL DEFAULT 0,
  line_ttc    NUMERIC(12,3) NOT NULL DEFAULT 0
);

-- 5. mandates
CREATE TABLE IF NOT EXISTS mandates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  accepted_by      UUID REFERENCES auth.users(id),
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address       TEXT,
  user_agent       TEXT,
  seal_identifier  TEXT,
  seal_valid_until DATE,
  scope            TEXT NOT NULL DEFAULT 'all_invoices',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at       TIMESTAMPTZ,
  revoked_by       UUID REFERENCES auth.users(id)
);

-- 6. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  related_id TEXT
);

-- 7. activity_log
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  description TEXT
);

-- 8. accountant_links  (user-level access to a company)
CREATE TABLE IF NOT EXISTS accountant_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  accountant_id UUID REFERENCES auth.users(id),
  invited_email TEXT,
  role          TEXT NOT NULL DEFAULT 'accountant',
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ
);

-- 9. api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id),
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  permissions  TEXT[] NOT NULL DEFAULT '{invoices:write,invoices:read}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  CONSTRAINT uq_api_key_hash UNIQUE (key_hash)
);

-- 10. ttn_queue
CREATE TABLE IF NOT EXISTS ttn_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error    TEXT,
  CONSTRAINT uq_queued_invoice UNIQUE (invoice_id)
);

-- 11. fiduciaire_clients  (must be created BEFORE policies on clients/invoices)
CREATE TABLE IF NOT EXISTS fiduciaire_clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiduciaire_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
  invited_email         TEXT,
  client_name           TEXT,
  invite_message        TEXT,
  invite_token          UUID NOT NULL DEFAULT gen_random_uuid(),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','revoked')),
  permissions           TEXT[] NOT NULL DEFAULT '{invoices:all,clients:all,tva:read}',
  invited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at           TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  CONSTRAINT uq_fid_invite_token UNIQUE (invite_token)
);

-- 12. waitlist  (Flash Financing early access)
CREATE TABLE IF NOT EXISTS waitlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  requested_amount NUMERIC(12,0),
  duration_months  INTEGER,
  status           TEXT NOT NULL DEFAULT 'pending'
);

-- 
-- STEP 2  ENABLE ROW LEVEL SECURITY ON EVERY TABLE
-- 
ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountant_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ttn_queue          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiduciaire_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist           ENABLE ROW LEVEL SECURITY;

-- 
-- STEP 3  RLS POLICIES
-- All tables exist now, so cross-references are safe.
-- 

-- companies: only the owner
CREATE POLICY "companies_owner_all" ON companies
  FOR ALL USING (owner_id = auth.uid());

-- clients: own company OR fiduciaire access
CREATE POLICY "clients_company_all" ON clients
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR company_id IN (
      SELECT fc.client_company_id
      FROM fiduciaire_clients fc
      JOIN companies c ON c.id = fc.fiduciaire_company_id
      WHERE c.owner_id = auth.uid() AND fc.status = 'active'
    )
  );

-- invoices: own company OR fiduciaire access
CREATE POLICY "invoices_company_all" ON invoices
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR company_id IN (
      SELECT fc.client_company_id
      FROM fiduciaire_clients fc
      JOIN companies c ON c.id = fc.fiduciaire_company_id
      WHERE c.owner_id = auth.uid() AND fc.status = 'active'
    )
  );

-- invoice_line_items: inherit invoice ownership
CREATE POLICY "line_items_via_invoice" ON invoice_line_items
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
         OR company_id IN (
           SELECT fc.client_company_id
           FROM fiduciaire_clients fc
           JOIN companies c ON c.id = fc.fiduciaire_company_id
           WHERE c.owner_id = auth.uid() AND fc.status = 'active'
         )
    )
  );

-- mandates: own company only
CREATE POLICY "mandates_company_all" ON mandates
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- notifications: own company only
CREATE POLICY "notifications_company_all" ON notifications
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- activity_log: own company only
CREATE POLICY "activity_log_company_all" ON activity_log
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- accountant_links: owner manages, accountant reads own
CREATE POLICY "accountant_links_all" ON accountant_links
  FOR ALL USING (
    company_id  IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    OR accountant_id = auth.uid()
  );

-- api_keys: own company only
CREATE POLICY "api_keys_company_all" ON api_keys
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- ttn_queue: inherit invoice ownership
CREATE POLICY "ttn_queue_via_invoice" ON ttn_queue
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
    )
  );

-- fiduciaire_clients: cabinet manages its own rows; PME reads invitations for its company
CREATE POLICY "fid_cabinet_all" ON fiduciaire_clients
  FOR ALL USING (
    fiduciaire_company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

CREATE POLICY "fid_pme_reads_invite" ON fiduciaire_clients
  FOR SELECT USING (
    client_company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- Also allow reading by invite_token (needed for /api/fiduciaire/accept)
CREATE POLICY "fid_accept_by_token" ON fiduciaire_clients
  FOR SELECT USING (true);  -- token matching done in app layer; token is unguessable UUID

-- waitlist: own company only
CREATE POLICY "waitlist_company_all" ON waitlist
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

-- 
-- STEP 4  INDEXES
-- 
CREATE INDEX IF NOT EXISTS idx_companies_owner        ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_company        ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company       ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date    ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client        ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ttn_id        ON invoices(ttn_id) WHERE ttn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_line_items_invoice     ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mandates_company       ON mandates(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notif_company          ON notifications(company_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_company       ON activity_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acct_links_company     ON accountant_links(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_links_accountant  ON accountant_links(accountant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_company       ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash          ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ttn_queue_retry        ON ttn_queue(next_retry_at, attempts) WHERE attempts < 5;
CREATE INDEX IF NOT EXISTS idx_fid_by_fiduciaire      ON fiduciaire_clients(fiduciaire_company_id);
CREATE INDEX IF NOT EXISTS idx_fid_by_client          ON fiduciaire_clients(client_company_id);
CREATE INDEX IF NOT EXISTS idx_fid_invite_token       ON fiduciaire_clients(invite_token);

-- 
-- STEP 5  HELPER FUNCTION (fiduciaire access check)
-- 
CREATE OR REPLACE FUNCTION is_fiduciaire_of(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM fiduciaire_clients fc
    JOIN companies c ON c.id = fc.fiduciaire_company_id
    WHERE c.owner_id      = auth.uid()
      AND fc.client_company_id = target_company_id
      AND fc.status        = 'active'
  );
$$;

-- 
-- STEP 6  updated_at TRIGGER
-- 
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

-- 
-- STEP 7  REALTIME  (enable for live dashboard updates)
-- 
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 
-- DONE   one manual step remains:
-- Supabase Dashboard > Storage > New bucket
--   Name   : logos
--   Public : YES (toggle on)
-- 
