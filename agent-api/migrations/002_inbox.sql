-- ============================================================================
-- 002_inbox.sql
-- Contacts, conversations and messages for all three channels — replaces the
-- in-memory seed in the dashboard's src/context/ConversationContext.jsx
-- ============================================================================

CREATE TYPE inbox_channel AS ENUM ('whatsapp', 'instagram', 'webchat');
CREATE TYPE conversation_status AS ENUM ('bot', 'agent', 'resolved');
CREATE TYPE inbox_message_type AS ENUM ('incoming', 'outgoing', 'note', 'event', 'answer', 'template');
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- ── CONTACTS ─────────────────────────────────────────────────────────────
-- One row per person per channel. Exactly one identity field is set, and
-- which one is fixed by the channel — the same rule the dashboard documents in
-- ConversationContext.jsx: phone for WhatsApp, handle for Instagram, an
-- ephemeral visitorId for Website Chat (whose visitors have no account).
CREATE TABLE contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel               inbox_channel NOT NULL,
  name                  VARCHAR(256) NOT NULL,
  avatar                VARCHAR(8),
  phone                 VARCHAR(32),
  handle                VARCHAR(64),
  visitor_id            VARCHAR(64),
  -- The provider's own id (WhatsApp wa_id, Instagram-scoped user id) used to
  -- address outbound sends. Distinct from the display identity above.
  external_id           VARCHAR(128),
  -- Instagram only: a conversation can only be *started* with a follower.
  is_follower           BOOLEAN NOT NULL DEFAULT false,
  -- Editable profile fields (email, company, city, …) — a bag rather than
  -- columns because the dashboard's panel shows a different set per channel.
  profile               JSONB NOT NULL DEFAULT '{}',
  custom_fields         JSONB NOT NULL DEFAULT '{}',
  -- Website Chat context: page, browser, os, location, referrer, visits, firstSeen.
  visitor_meta          JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT contacts_identity_matches_channel CHECK (
    (channel = 'whatsapp'  AND phone IS NOT NULL      AND handle IS NULL AND visitor_id IS NULL) OR
    (channel = 'instagram' AND handle IS NOT NULL     AND phone IS NULL  AND visitor_id IS NULL) OR
    (channel = 'webchat'   AND visitor_id IS NOT NULL AND handle IS NULL)
    -- webchat may also carry a phone the visitor typed into the bot flow.
  )
);

CREATE UNIQUE INDEX uq_contacts_whatsapp_phone ON contacts (phone) WHERE channel = 'whatsapp';
CREATE UNIQUE INDEX uq_contacts_instagram_handle ON contacts (lower(handle)) WHERE channel = 'instagram';
CREATE UNIQUE INDEX uq_contacts_webchat_visitor ON contacts (visitor_id) WHERE channel = 'webchat';

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── CONVERSATIONS ────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  channel               inbox_channel NOT NULL,
  status                conversation_status NOT NULL DEFAULT 'bot',
  agent_id              UUID REFERENCES users (id) ON DELETE SET NULL,
  -- WhatsApp: direct | ctwa | g-ctwa | t-ctwa | broadcast.
  -- Instagram: dm | comment | story — each replies differently, so this is
  -- behaviour, not just a filter facet (see src/channels/instagram.ts).
  source                VARCHAR(32) NOT NULL DEFAULT 'direct',
  labels                TEXT[] NOT NULL DEFAULT '{}',
  last_message          TEXT NOT NULL DEFAULT '',
  last_message_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread                INTEGER NOT NULL DEFAULT 0 CHECK (unread >= 0),
  starred               BOOLEAN NOT NULL DEFAULT false,
  archived              BOOLEAN NOT NULL DEFAULT false,
  snoozed_until         TIMESTAMPTZ,
  -- WhatsApp's 24-hour customer service window is measured from the
  -- customer's most recent message. Outside it only templates may be sent.
  last_inbound_at       TIMESTAMPTZ,
  -- Instagram comment / story: the provider object being replied to
  -- (comment id, story media id). Null for DMs and other channels.
  external_ref          VARCHAR(128),
  -- Set when the bot asks for a human and no agent is online to take it.
  -- Cleared on assignment. When someone goes online, the oldest waiting
  -- chats are routed to them first (src/services/routingService.ts).
  needs_agent_since     TIMESTAMPTZ,
  -- Bumped by trigger on every UPDATE. Live events carry it and clients drop
  -- anything not strictly newer than what they hold — the same idempotent,
  -- replay-safe scheme as the bot-config stream (backend migration 004).
  version               BIGINT NOT NULL DEFAULT 1,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT conversations_agent_status CHECK (status <> 'agent' OR agent_id IS NOT NULL)
);

CREATE INDEX idx_conversations_list ON conversations (last_message_at DESC, id DESC);
CREATE INDEX idx_conversations_agent ON conversations (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_conversations_status ON conversations (status);
CREATE INDEX idx_conversations_channel ON conversations (channel);
CREATE INDEX idx_conversations_labels ON conversations USING GIN (labels);
CREATE INDEX idx_conversations_contact ON conversations (contact_id);
CREATE INDEX idx_conversations_waiting ON conversations (needs_agent_since) WHERE needs_agent_since IS NOT NULL;

CREATE OR REPLACE FUNCTION bump_conversation_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversations_version BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION bump_conversation_version();

-- ── MESSAGES ─────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  type                  inbox_message_type NOT NULL,
  text                  TEXT NOT NULL DEFAULT '',
  -- Display name of who wrote it: contact name, 'Bot', or the agent's name.
  sender                VARCHAR(256),
  agent_id              UUID REFERENCES users (id) ON DELETE SET NULL,
  agent_name            VARCHAR(256),
  -- type = 'template': { name, language, category, variables, header, body, footer, buttons }
  template              JSONB,
  -- type = 'answer': a structured value the bot flow captured.
  question_type         VARCHAR(32),
  label                 VARCHAR(256),
  value                 TEXT,
  -- type = 'event': machine-readable kind (assigned, bot_handover, call_missed, …).
  event                 VARCHAR(64),
  delivery              delivery_status,
  external_id           VARCHAR(128),
  -- Client-generated id for outbound sends. A retried POST after a dropped
  -- response on a flaky mobile network must not post the reply twice.
  client_msg_id         VARCHAR(64),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messages (conversation_id, created_at, id);
CREATE UNIQUE INDEX uq_messages_client_id ON messages (conversation_id, client_msg_id) WHERE client_msg_id IS NOT NULL;
CREATE UNIQUE INDEX uq_messages_external_id ON messages (external_id) WHERE external_id IS NOT NULL;

-- ── WHATSAPP TEMPLATES ───────────────────────────────────────────────────
-- Mirror of the WABA's approved templates (synced from Meta in production,
-- seeded from the dashboard's TEMPLATES list in dev). Only APPROVED ones may
-- be sent.
CREATE TABLE wa_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(256) NOT NULL,
  language              VARCHAR(16) NOT NULL DEFAULT 'en_US',
  category              VARCHAR(32) NOT NULL,
  status                VARCHAR(32) NOT NULL,
  header_type           VARCHAR(16) NOT NULL DEFAULT 'NONE',
  header                TEXT,
  body                  TEXT NOT NULL,
  footer                TEXT,
  buttons               TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

-- ── EVENT LOG ────────────────────────────────────────────────────────────
-- Every change the live stream publishes is written here first, in the same
-- transaction as the change itself, and its id is the SSE event id. That buys
-- two things at once:
--   * Resume: a client reconnecting with Last-Event-ID gets exactly what it
--     missed (id > N), not a full reload — important on mobile networks that
--     drop every few minutes.
--   * Fan-out across API instances without Redis: an AFTER INSERT trigger
--     pg_notify()s the id, and every instance LISTENs. NOTIFY is delivered
--     only on COMMIT, so no instance can announce a change that later rolls
--     back.
-- Rows are pruned after a few days (sweeper in src/services/sweeper.ts); a
-- client whose Last-Event-ID is older than the oldest row is told to resync.
CREATE TABLE inbox_events (
  id                    BIGSERIAL PRIMARY KEY,
  kind                  VARCHAR(48) NOT NULL,
  conversation_id       UUID,
  payload               JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_events_created ON inbox_events (created_at);

CREATE OR REPLACE FUNCTION notify_inbox_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('inbox_events', NEW.id::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inbox_events_notify AFTER INSERT ON inbox_events
  FOR EACH ROW EXECUTE FUNCTION notify_inbox_event();
