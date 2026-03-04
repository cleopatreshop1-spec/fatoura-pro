-- Add receipt_url to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;
