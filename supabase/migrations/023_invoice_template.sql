-- Invoice template customization fields on companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_accent_color text NOT NULL DEFAULT '#1a1a2e';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_font        text NOT NULL DEFAULT 'helvetica';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_logo_position text NOT NULL DEFAULT 'left';
