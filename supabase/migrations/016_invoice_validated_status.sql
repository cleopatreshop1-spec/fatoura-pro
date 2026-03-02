-- Add 'validated' to the invoices status CHECK constraint
-- 'validated' = finalized by user, not yet submitted to TTN

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'validated', 'queued', 'pending', 'valid', 'rejected'));
