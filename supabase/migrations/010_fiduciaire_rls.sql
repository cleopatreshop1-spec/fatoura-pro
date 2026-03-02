-- FIX 9: Centralized RLS authorization function
CREATE OR REPLACE FUNCTION user_can_access_company(target_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies
    WHERE id = target_company_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM fiduciaire_clients fc
    JOIN companies c ON c.id = fc.fiduciaire_company_id
    WHERE fc.client_company_id = target_company_id
      AND fc.status = 'active'
      AND c.owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- invoices
DROP POLICY IF EXISTS "invoices_company_isolation" ON invoices;
DROP POLICY IF EXISTS "invoices_access" ON invoices;
CREATE POLICY "invoices_access" ON invoices
  USING (user_can_access_company(company_id));

-- clients
DROP POLICY IF EXISTS "clients_company_isolation" ON clients;
DROP POLICY IF EXISTS "clients_access" ON clients;
CREATE POLICY "clients_access" ON clients
  USING (user_can_access_company(company_id));

-- invoice_line_items (via invoice join)
DROP POLICY IF EXISTS "line_items_select" ON invoice_line_items;
DROP POLICY IF EXISTS "line_items_insert" ON invoice_line_items;
DROP POLICY IF EXISTS "line_items_delete" ON invoice_line_items;
DROP POLICY IF EXISTS "line_items_via_invoice" ON invoice_line_items;
DROP POLICY IF EXISTS "line_items_access" ON invoice_line_items;
CREATE POLICY "line_items_access" ON invoice_line_items
  USING (invoice_id IN (
    SELECT id FROM invoices WHERE user_can_access_company(company_id)
  ))
  WITH CHECK (invoice_id IN (
    SELECT id FROM invoices WHERE user_can_access_company(company_id)
  ));

-- mandates
DROP POLICY IF EXISTS "mandates_company_isolation" ON mandates;
DROP POLICY IF EXISTS "mandates_access" ON mandates;
CREATE POLICY "mandates_access" ON mandates
  USING (user_can_access_company(company_id));

-- ttn_queue
DROP POLICY IF EXISTS "ttn_queue_company_isolation" ON ttn_queue;
DROP POLICY IF EXISTS "ttn_queue_access" ON ttn_queue;
CREATE POLICY "ttn_queue_access" ON ttn_queue
  USING (invoice_id IN (
    SELECT id FROM invoices WHERE user_can_access_company(company_id)
  ));

-- notifications
DROP POLICY IF EXISTS "notifications_company_isolation" ON notifications;
DROP POLICY IF EXISTS "notifications_access" ON notifications;
CREATE POLICY "notifications_access" ON notifications
  USING (user_can_access_company(company_id));

-- activity_log
DROP POLICY IF EXISTS "activity_log_company_isolation" ON activity_log;
DROP POLICY IF EXISTS "activity_log_access" ON activity_log;
CREATE POLICY "activity_log_access" ON activity_log
  USING (user_can_access_company(company_id));

-- notification_preferences
DROP POLICY IF EXISTS "notif_prefs_company_isolation" ON notification_preferences;
DROP POLICY IF EXISTS "notif_prefs_access" ON notification_preferences;
CREATE POLICY "notif_prefs_access" ON notification_preferences
  USING (user_can_access_company(company_id));

-- waitlist
DROP POLICY IF EXISTS "waitlist_company_isolation" ON waitlist;
DROP POLICY IF EXISTS "waitlist_access" ON waitlist;
CREATE POLICY "waitlist_access" ON waitlist
  USING (user_can_access_company(company_id));
