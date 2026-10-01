-- ============================================================================
-- 005_attachments.sql
-- Files sent in conversations
-- ============================================================================

-- Up Migration

-- ── ATTACHMENTS ──────────────────────────────────────────────────────────
-- Files an agent sends (and, later, files customers send). The bytes live in
-- the file store (local disk in dev, object storage in production) under
-- `storage_key`; this row is what authorizes and describes them.
--
-- An upload belongs to one conversation from the start, so a file can only
-- ever be attached to a message in the thread it was uploaded for. Uploads
-- never sent (message_id stays NULL) are swept after a day.
CREATE TABLE attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  uploaded_by      UUID REFERENCES users (id) ON DELETE SET NULL,
  kind             VARCHAR(16) NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'document')),
  file_name        VARCHAR(160) NOT NULL,
  mime_type        VARCHAR(128) NOT NULL,
  size_bytes       INTEGER NOT NULL CHECK (size_bytes > 0),
  width            INTEGER,
  height           INTEGER,
  storage_key      VARCHAR(256) NOT NULL,
  message_id       UUID REFERENCES messages (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_conversation ON attachments (conversation_id);
CREATE INDEX idx_attachments_unsent ON attachments (created_at) WHERE message_id IS NULL;

-- A snapshot on the message ({ id, kind, name, mime, size, width, height }),
-- so a thread renders without a join. URLs are signed at read time, never stored.
ALTER TABLE messages ADD COLUMN attachment JSONB;

-- Down Migration

ALTER TABLE messages DROP COLUMN IF EXISTS attachment;
DROP TABLE IF EXISTS attachments;
