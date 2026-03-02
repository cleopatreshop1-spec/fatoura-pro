-- FIX AI: ai_suggestions table for proactive AI nudges
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info', -- info | warning | action
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_company_unread
  ON ai_suggestions(company_id, is_read) WHERE is_read = FALSE;

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_suggestions_company_access" ON ai_suggestions
  FOR ALL USING (user_can_access_company(company_id));
