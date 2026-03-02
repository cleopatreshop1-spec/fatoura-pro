-- Atomic invoice number generation — prevents race conditions under concurrent load
CREATE OR REPLACE FUNCTION increment_invoice_counter(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_counter INTEGER;
  v_prefix  TEXT;
  v_year    TEXT;
BEGIN
  UPDATE companies
  SET invoice_counter = COALESCE(invoice_counter, 0) + 1
  WHERE id = p_company_id
  RETURNING invoice_counter, invoice_prefix
    INTO v_counter, v_prefix;

  v_year := EXTRACT(YEAR FROM NOW())::TEXT;

  RETURN COALESCE(v_prefix, 'FP') || '-' || v_year || '-' || LPAD(v_counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Ensure invoice_counter column exists
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_counter INTEGER NOT NULL DEFAULT 0;
