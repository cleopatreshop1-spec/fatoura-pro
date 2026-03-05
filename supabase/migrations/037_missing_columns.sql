-- 037_missing_columns.sql
-- Add columns that are used in application code but missing from the schema

-- invoice_line_items: tva_exempt_reason and category (used in InvLine type)
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS tva_exempt_reason TEXT;
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS category          TEXT;

-- Ensure discount column exists (was added in 036, but this is idempotent)
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS discount NUMERIC(5,2) DEFAULT NULL;

-- invoices: ensure source column exists (added in 018, idempotent safety)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- companies: ensure slug column exists (added in 028, idempotent safety)  
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
