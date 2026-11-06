-- ============================================================================
-- 013_ctwa_connections.sql
-- The Meta account a workspace connected through the Facebook popup (Click-to-WhatsApp ads).
-- The access token is stored encrypted (AES-256-GCM, key from CONNECTIONS_SECRET / AI_SETTINGS_SECRET).
-- ============================================================================

CREATE TABLE ctwa_connections (
  workspace_id  VARCHAR(100) PRIMARY KEY,
  token_enc     TEXT         NOT NULL,
  user_name     VARCHAR(200),
  business_id   VARCHAR(50),
  ad_accounts   JSONB        NOT NULL DEFAULT '[]',   -- [{ id, name, currency }] the customer shared
  pages         JSONB        NOT NULL DEFAULT '[]',   -- [{ id, name }]
  wabas         JSONB        NOT NULL DEFAULT '[]',   -- [{ id, name }]
  dataset_id    VARCHAR(50),
  selected      JSONB        NOT NULL DEFAULT '{}',   -- { adAccountId, pageId, wabaId }
  connected_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
