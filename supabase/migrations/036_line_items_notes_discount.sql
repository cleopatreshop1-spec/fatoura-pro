-- 036_line_items_notes_discount.sql
-- Add notes, discount, and company_id to invoice_line_items

ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS notes       TEXT;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS discount    NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS company_id  UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Back-fill company_id from parent invoice
UPDATE invoice_line_items li
SET company_id = i.company_id
FROM invoices i
WHERE li.invoice_id = i.id
  AND li.company_id IS NULL;

-- Index for fast company-scoped queries (pastDescriptions autocomplete)
CREATE INDEX IF NOT EXISTS idx_line_items_company ON invoice_line_items(company_id);
