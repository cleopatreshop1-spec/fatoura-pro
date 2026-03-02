-- FIX 11: Soft delete for invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE OR REPLACE VIEW invoices_active AS
  SELECT * FROM invoices WHERE deleted_at IS NULL;
