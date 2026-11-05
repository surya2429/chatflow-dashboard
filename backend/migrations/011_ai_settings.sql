-- ============================================================================
-- 011_ai_settings.sql
-- The AI model + API key a workspace chose for the inbox AI (key encrypted with AI_SETTINGS_SECRET)
-- ============================================================================

CREATE TABLE ai_settings (
  workspace_id  VARCHAR(100) PRIMARY KEY,
  provider      VARCHAR(20)  NOT NULL,
  model         VARCHAR(80)  NOT NULL,
  api_key_enc   TEXT         NOT NULL,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
