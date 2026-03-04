-- Storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated users to manage their own receipts
CREATE POLICY "receipts_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');
