-- ============================================================================
-- 004_bots.sql
-- Chatbots, and which agents work each one
-- ============================================================================

-- A workspace runs several bots — e.g. a WhatsApp support number, a WhatsApp
-- sales number, an Instagram account, a website widget. Every conversation
-- belongs to exactly one bot, and agents are assigned to the bots they handle.
-- An agent only sees (and is only routed) conversations of their bots;
-- supervisors and admins see every bot.
CREATE TYPE bot_status AS ENUM ('active', 'paused');

CREATE TABLE bots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(128) NOT NULL,
  channel               inbox_channel NOT NULL,
  -- What customers reach it on: the WhatsApp number, the Instagram handle,
  -- the website domain. Display only.
  identity              VARCHAR(128) NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  status                bot_status NOT NULL DEFAULT 'active',
  color                 VARCHAR(16) NOT NULL DEFAULT '#0066ff',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bot_agents (
  bot_id                UUID NOT NULL REFERENCES bots (id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (bot_id, user_id)
);
CREATE INDEX idx_bot_agents_user ON bot_agents (user_id);

ALTER TABLE conversations ADD COLUMN bot_id UUID REFERENCES bots (id) ON DELETE SET NULL;
CREATE INDEX idx_conversations_bot ON conversations (bot_id);
