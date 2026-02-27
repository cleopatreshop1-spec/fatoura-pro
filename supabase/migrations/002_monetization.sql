-- ============================================================
-- FATOURA PRO — Monetization Schema
-- Run AFTER 001_full_setup.sql
-- ============================================================

-- ─────────────────────────────────────────────────
-- 1. PLANS (static catalog)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price_monthly NUMERIC(8,3) NOT NULL,
  price_yearly  NUMERIC(8,3),
  invoice_limit INTEGER,        -- NULL = unlimited
  user_limit    INTEGER,
  client_limit  INTEGER,        -- fiduciaire plan: max PME clients
  features      JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO plans (id, name, price_monthly, price_yearly, invoice_limit, user_limit, client_limit, features) VALUES
  ('trialing',    'Essai gratuit', 0,       0,        20,   1,    NULL, '{"ttn":true,"pdf":true,"tva":true}'),
  ('starter',     'Starter',       29.000,  295.000,  50,   1,    NULL, '{"ttn":true,"pdf":true,"tva":true,"support":"email"}'),
  ('pro',         'Pro',           79.000,  805.000,  NULL, 3,    NULL, '{"ttn":true,"pdf":true,"tva":true,"mandate":true,"financing":true,"erp_import":true,"support":"priority"}'),
  ('fiduciaire',  'Fiduciaire',    199.000, 2030.000, NULL, NULL, 50,   '{"ttn":true,"pdf":true,"tva":true,"mandate":true,"financing":true,"erp_import":true,"multi_clients":true,"support":"account_manager"}'),
  ('enterprise',  'Enterprise',    0,       0,         NULL, NULL, NULL, '{"ttn":true,"pdf":true,"tva":true,"mandate":true,"financing":true,"erp_import":true,"multi_clients":true,"api":true,"sla":"99.9","support":"dedicated"}')
ON CONFLICT (id) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly  = EXCLUDED.price_yearly,
  features      = EXCLUDED.features;

-- ─────────────────────────────────────────────────
-- 2. SUBSCRIPTIONS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id                  TEXT NOT NULL REFERENCES plans(id),
  status                   TEXT NOT NULL DEFAULT 'trialing'
                             CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  billing_cycle            TEXT NOT NULL DEFAULT 'monthly'
                             CHECK (billing_cycle IN ('monthly','yearly')),
  trial_ends_at            TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  payment_provider         TEXT CHECK (payment_provider IN ('konnect','stripe','manual')),
  provider_subscription_id TEXT,
  last_payment_at          TIMESTAMPTZ,
  last_payment_amount      NUMERIC(8,3),
  invoices_used_this_month INTEGER NOT NULL DEFAULT 0,
  invoices_reset_at        TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_company_subscription UNIQUE (company_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_company_all" ON subscriptions
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_sub_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_sub_status  ON subscriptions(status);

-- ─────────────────────────────────────────────────
-- 3. PAYMENTS (history)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount              NUMERIC(8,3) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'TND',
  status              TEXT NOT NULL
                        CHECK (status IN ('succeeded','failed','pending','refunded')),
  payment_method      TEXT CHECK (payment_method IN ('card','virement','especes')),
  provider_payment_id TEXT UNIQUE,
  description         TEXT,
  invoice_url         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_company_all" ON payments
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sub     ON payments(subscription_id);

-- ─────────────────────────────────────────────────
-- 4. FINANCING REQUESTS (drop old version to avoid conflicts)
-- ─────────────────────────────────────────────────
DROP TABLE IF EXISTS financing_requests CASCADE;

CREATE TABLE financing_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount_requested NUMERIC(12,3) NOT NULL,
  duration_months  INTEGER NOT NULL,
  purpose          TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','reviewing','approved','rejected','funded','repaid')),
  eligible_amount  NUMERIC(12,3),
  approved_amount  NUMERIC(12,3),
  interest_rate    NUMERIC(5,2),
  monthly_payment  NUMERIC(12,3),
  partner_name     TEXT,
  commission_amount NUMERIC(8,3),
  funded_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financing_company_all" ON financing_requests
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_financing_company ON financing_requests(company_id, created_at DESC);

-- ─────────────────────────────────────────────────
-- 5. ADD missing columns TO companies (defensive)
-- ─────────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'trialing' REFERENCES plans(id);

-- Back-fill existing rows
UPDATE companies SET current_plan = 'trialing' WHERE current_plan IS NULL;

-- ─────────────────────────────────────────────────
-- 6. AUTO-CREATE subscription when company is created
-- ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO subscriptions (company_id, plan_id, status)
  VALUES (NEW.id, 'trialing', 'trialing')
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_subscription ON companies;
CREATE TRIGGER trg_default_subscription
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Back-fill subscriptions for existing companies
-- Using only id column which is guaranteed to exist on any companies table
INSERT INTO subscriptions (company_id, plan_id, status)
SELECT id, 'trialing', 'trialing' FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- ─────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────
