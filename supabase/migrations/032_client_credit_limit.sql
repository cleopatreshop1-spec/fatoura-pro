-- 032_client_credit_limit.sql
-- Add optional credit limit to clients

ALTER TABLE clients ADD COLUMN IF NOT EXISTS credit_limit numeric(12,3) DEFAULT NULL;
