-- MODULE 5: Anomaly detection table
CREATE TABLE IF NOT EXISTS anomalies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id   UUID REFERENCES invoices(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  message      TEXT NOT NULL,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_company_active
  ON anomalies(company_id, is_dismissed) WHERE is_dismissed = FALSE;

CREATE INDEX IF NOT EXISTS idx_anomalies_invoice
  ON anomalies(invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anomalies_company_access" ON anomalies
  FOR ALL USING (user_can_access_company(company_id));

-- MODULE 9: Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  merchant    TEXT,
  amount      NUMERIC(12,3) NOT NULL,
  category    TEXT,
  tva_amount  NUMERIC(12,3),
  tva_rate    NUMERIC(4,1),
  receipt_url TEXT,
  notes       TEXT,
  source      TEXT NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date
  ON expenses(company_id, date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_company_access" ON expenses
  FOR ALL USING (user_can_access_company(company_id));
