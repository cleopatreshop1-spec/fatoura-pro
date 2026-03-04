-- Internal memo field on invoices (visible only to owner, never shown on PDF)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS internal_memo text;
