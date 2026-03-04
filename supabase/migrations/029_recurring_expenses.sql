-- Recurring expense templates (auto-logged each month)
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount      numeric(12,3) NOT NULL,
  category    text NOT NULL,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  day_of_month int NOT NULL DEFAULT 1,  -- which day of month to log it
  last_logged date,                      -- last date an entry was created
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_own_recurring" ON recurring_expenses
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );
