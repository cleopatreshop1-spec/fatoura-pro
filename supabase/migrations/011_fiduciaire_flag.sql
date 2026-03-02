-- FIX 10: is_fiduciaire flag on companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS is_fiduciaire BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_companies_fiduciaire
  ON companies(owner_id) WHERE is_fiduciaire = TRUE;
