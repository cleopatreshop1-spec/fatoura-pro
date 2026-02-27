-- ============================================================
-- FATOURA PRO — Invoice usage tracking trigger
-- Run AFTER 002_monetization.sql
-- ============================================================

-- Function: increment invoices_used_this_month on INSERT
-- Also handles monthly reset automatically.
CREATE OR REPLACE FUNCTION track_invoice_usage()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_company_id UUID;
  v_reset_at   TIMESTAMPTZ;
BEGIN
  v_company_id := NEW.company_id;

  -- Fetch the reset timestamp for this company's subscription
  SELECT invoices_reset_at
    INTO v_reset_at
    FROM subscriptions
   WHERE company_id = v_company_id;

  -- If reset_at is NULL or older than the 1st of the current month, reset counter
  IF v_reset_at IS NULL OR
     DATE_TRUNC('month', v_reset_at) < DATE_TRUNC('month', NOW())
  THEN
    UPDATE subscriptions
       SET invoices_used_this_month = 1,
           invoices_reset_at        = DATE_TRUNC('month', NOW())
     WHERE company_id = v_company_id;
  ELSE
    UPDATE subscriptions
       SET invoices_used_this_month = invoices_used_this_month + 1
     WHERE company_id = v_company_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger: fires only on INSERT of a NEW invoice (not updates/drafts re-saves)
DROP TRIGGER IF EXISTS trg_invoice_usage ON invoices;
CREATE TRIGGER trg_invoice_usage
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION track_invoice_usage();
