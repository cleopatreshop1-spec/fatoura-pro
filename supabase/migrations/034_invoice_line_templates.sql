-- 034_invoice_line_templates.sql
-- Reusable invoice line-item templates

CREATE TABLE IF NOT EXISTS invoice_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_template_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES invoice_templates(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  description  text NOT NULL,
  quantity     numeric(12,3) NOT NULL DEFAULT 1,
  unit_price   numeric(12,3) NOT NULL DEFAULT 0,
  tva_rate     integer NOT NULL DEFAULT 19 CHECK (tva_rate IN (0,7,13,19))
);

ALTER TABLE invoice_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_template_lines  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_invoice_templates" ON invoice_templates
  FOR ALL USING (company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  ));

CREATE POLICY "company_invoice_template_lines" ON invoice_template_lines
  FOR ALL USING (template_id IN (
    SELECT t.id FROM invoice_templates t
    JOIN companies c ON c.id = t.company_id
    WHERE c.owner_id = auth.uid()
  ));
