-- 033_expense_category_budgets.sql
-- Monthly budget limits per expense category

CREATE TABLE IF NOT EXISTS expense_budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category    text NOT NULL,
  monthly_limit numeric(12,3) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, category)
);

ALTER TABLE expense_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_expense_budgets" ON expense_budgets
  FOR ALL USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));
