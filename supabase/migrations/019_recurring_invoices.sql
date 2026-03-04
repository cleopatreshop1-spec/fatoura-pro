-- 019_recurring_invoices.sql
-- Recurring invoice templates table

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  name            text NOT NULL,
  frequency       text NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  next_date       date NOT NULL,
  last_generated  date,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_invoice_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id uuid NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  sort_order           integer NOT NULL DEFAULT 0,
  description          text NOT NULL,
  quantity             numeric(12,3) NOT NULL DEFAULT 1,
  unit_price           numeric(12,3) NOT NULL DEFAULT 0,
  tva_rate             integer NOT NULL DEFAULT 19 CHECK (tva_rate IN (0,7,13,19))
);

-- RLS
ALTER TABLE recurring_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoice_lines  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_recurring" ON recurring_invoices
  FOR ALL USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "company_recurring_lines" ON recurring_invoice_lines
  FOR ALL USING (recurring_invoice_id IN (
    SELECT ri.id FROM recurring_invoices ri
    JOIN companies c ON c.id = ri.company_id
    WHERE c.owner_id = auth.uid()
  ));

-- Index for the cron job
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_date
  ON recurring_invoices (next_date) WHERE is_active = true;
