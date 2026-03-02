-- FIX 6: Performance indexes for most frequent queries
CREATE INDEX IF NOT EXISTS idx_invoices_company_status
  ON invoices(company_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_company_date
  ON invoices(company_id, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted
  ON invoices(company_id) WHERE deleted_at IS NULL;

-- invoice_line_items uses the correct table name
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id
  ON invoice_line_items(invoice_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_clients_company_id
  ON clients(company_id);

CREATE INDEX IF NOT EXISTS idx_notifications_company_unread
  ON notifications(company_id, is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_ttn_queue_next_retry
  ON ttn_queue(next_retry_at) WHERE attempts < max_attempts;

CREATE INDEX IF NOT EXISTS idx_fiduciaire_clients_active
  ON fiduciaire_clients(fiduciaire_company_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_activity_log_company
  ON activity_log(company_id, created_at DESC);
