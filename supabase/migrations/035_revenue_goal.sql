-- 035_revenue_goal.sql
-- Monthly / annual revenue goal targets

ALTER TABLE companies ADD COLUMN IF NOT EXISTS monthly_revenue_goal numeric(14,3) DEFAULT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS annual_revenue_goal  numeric(14,3) DEFAULT NULL;
