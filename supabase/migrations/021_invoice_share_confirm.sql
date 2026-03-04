-- Add client confirmation tracking for shared invoice links
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;
