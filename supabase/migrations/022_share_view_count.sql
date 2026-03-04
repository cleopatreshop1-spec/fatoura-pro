-- Add view counter to invoices for public share link tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS share_view_count integer NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS share_last_viewed_at timestamptz;
