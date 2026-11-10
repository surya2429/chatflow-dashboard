-- 016_webchat_media.sql — photos and videos uploaded for the website chat (Property Cards).
-- Kept in Postgres so uploads survive redeploys and work on every API replica without a shared disk. ids are random
-- (unguessable) and the rows never change, so responses are cached for a year.
CREATE TABLE webchat_media (
  id          CHAR(32) PRIMARY KEY,
  bot_ref     VARCHAR(64) NOT NULL,
  mime        VARCHAR(64) NOT NULL,
  size_bytes  INTEGER NOT NULL,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webchat_media_bot ON webchat_media (bot_ref, created_at);
