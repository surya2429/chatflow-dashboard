-- ============================================================================
-- 002_instagram_oauth.sql
-- Instagram API with Instagram Login ("Business Login") — connected accounts
-- ============================================================================

-- One row per connected Instagram professional account. `ig_user_id` is the
-- Instagram-scoped user id returned by the short-lived token exchange — the
-- stable identity to upsert on, since a workspace may reconnect the same
-- account (new tokens) without creating a duplicate row.
CREATE TABLE instagram_accounts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ig_user_id           VARCHAR(64) NOT NULL UNIQUE,
  username             VARCHAR(256) NOT NULL,
  access_token         TEXT NOT NULL,               -- long-lived token (60-day validity, refreshable)
  token_expires_at     TIMESTAMPTZ NOT NULL,
  scopes               TEXT[] NOT NULL DEFAULT '{}',
  connected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at    TIMESTAMPTZ,
  disconnected_at      TIMESTAMPTZ,                  -- soft-disconnect; keeps history instead of deleting
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_instagram_accounts_active
  ON instagram_accounts (disconnected_at) WHERE disconnected_at IS NULL;

CREATE TRIGGER trg_instagram_accounts_updated_at BEFORE UPDATE ON instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
