-- Add share token to invoices for public shareable links
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_invoices_share_token ON invoices(share_token) WHERE share_token IS NOT NULL;

-- Public read policy: anyone with the token can view the invoice (no auth required)
-- We handle this at the API layer by checking the token directly (no RLS bypass needed)
-- since we query by share_token which is unguessable (UUID v4)
