-- FIX 4: Waitlist table for Flash Financing feature
CREATE TABLE IF NOT EXISTS waitlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  requested_amount NUMERIC(12,3) NOT NULL,
  duration_months  INTEGER NOT NULL CHECK (duration_months IN (1, 3, 6, 12)),
  status           TEXT DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_company_isolation" ON waitlist;
CREATE POLICY "waitlist_company_isolation" ON waitlist
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));
