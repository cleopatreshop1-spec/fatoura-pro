-- Multi-currency support on invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TND';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,6) DEFAULT 1;
