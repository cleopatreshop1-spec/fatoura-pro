-- ========================================================
-- Migration: Mode Fiduciaire
-- Run in Supabase SQL Editor
-- ========================================================

-- 1. Add is_fiduciaire flag to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS is_fiduciaire BOOLEAN DEFAULT FALSE;

-- 2. Fiduciaire-client relationships
CREATE TABLE IF NOT EXISTS fiduciaire_clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiduciaire_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
  invited_email         TEXT,
  client_name           TEXT,
  invite_message        TEXT,
  invite_token          UUID DEFAULT gen_random_uuid(),
  status                TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','active','revoked')),
  permissions           TEXT[] DEFAULT '{"invoices:all","clients:all","tva:read"}',
  invited_at            TIMESTAMPTZ DEFAULT NOW(),
  accepted_at           TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  CONSTRAINT unique_fiduciaire_client
    UNIQUE (fiduciaire_company_id, client_company_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_fid_by_fiduciaire ON fiduciaire_clients(fiduciaire_company_id);
CREATE INDEX IF NOT EXISTS idx_fid_by_client     ON fiduciaire_clients(client_company_id);
CREATE INDEX IF NOT EXISTS idx_fid_invite_token  ON fiduciaire_clients(invite_token);

-- 4. RLS
ALTER TABLE fiduciaire_clients ENABLE ROW LEVEL SECURITY;

-- Cabinet can see/manage its own client relationships
CREATE POLICY "fiduciaire_sees_own_links"
  ON fiduciaire_clients FOR ALL
  USING (
    fiduciaire_company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

-- PME can see invitations sent to them
CREATE POLICY "client_sees_own_invitation"
  ON fiduciaire_clients FOR SELECT
  USING (
    client_company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

-- 5. RLS on invoices/clients: allow fiduciaire to access client data
-- (Extend existing RLS or use a helper function)

CREATE OR REPLACE FUNCTION is_fiduciaire_of(target_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM fiduciaire_clients fc
    JOIN companies c ON c.id = fc.fiduciaire_company_id
    WHERE c.owner_id = auth.uid()
      AND fc.client_company_id = target_company_id
      AND fc.status = 'active'
  );
$$;

-- Allow fiduciaire to read invoices of its clients
CREATE POLICY "fiduciaire_reads_client_invoices"
  ON invoices FOR SELECT
  USING (
    company_id = (SELECT id FROM companies WHERE owner_id = auth.uid() LIMIT 1)
    OR is_fiduciaire_of(company_id)
  );
