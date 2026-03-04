-- Expense tracker table
CREATE TABLE IF NOT EXISTS expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id  uuid REFERENCES invoices(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount      numeric(12,3) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'TND',
  category    text NOT NULL DEFAULT 'autre',
  date        date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_company_owner" ON expenses
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS expenses_company_id_idx ON expenses(company_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(date DESC);
