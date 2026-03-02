-- FIX 8: Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  invoice_validated_email  BOOLEAN NOT NULL DEFAULT TRUE,
  invoice_rejected_email   BOOLEAN NOT NULL DEFAULT TRUE,
  mandate_expiring_email   BOOLEAN NOT NULL DEFAULT TRUE,
  cert_expiring_email      BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_tva_email        BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_report_email      BOOLEAN NOT NULL DEFAULT FALSE,
  notification_email       TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_company_isolation" ON notification_preferences;
CREATE POLICY "notif_prefs_company_isolation" ON notification_preferences
  USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_default_notification_preferences();

-- Back-fill for existing companies
INSERT INTO notification_preferences (company_id)
SELECT id FROM companies
ON CONFLICT (company_id) DO NOTHING;
