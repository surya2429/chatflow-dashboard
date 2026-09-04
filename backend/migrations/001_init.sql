-- ============================================================================
-- 001_init.sql
-- Unified WhatsApp Cloud API + MM Lite integration — core schema
-- Target: PostgreSQL 14+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM TYPES ───────────────────────────────────────────────────────────

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TYPE message_channel AS ENUM ('mm_lite', 'cloud_api');

CREATE TYPE message_status AS ENUM (
  'queued', 'sent', 'delivered', 'read', 'failed', 'deleted'
);

CREATE TYPE message_category AS ENUM (
  'marketing', 'utility', 'authentication', 'service'
);

CREATE TYPE campaign_status AS ENUM (
  'draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'
);

CREATE TYPE conversation_actor AS ENUM ('bot', 'human', 'unassigned');

CREATE TYPE consent_source AS ENUM (
  'signup_form', 'inbound_message', 'manual_import', 'api', 'admin_override'
);

-- ── CONTACTS ─────────────────────────────────────────────────────────────
-- One row per WhatsApp user (wa_id). Tracks marketing consent independently
-- from the 24h service-window state (see `conversations`), because consent
-- is a durable opt-in/opt-out flag, not a rolling session.

CREATE TABLE contacts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_id                VARCHAR(32) NOT NULL UNIQUE,           -- E.164 without '+', as Meta sends it
  phone_number         VARCHAR(32) NOT NULL,
  display_name         VARCHAR(256),
  profile_name         VARCHAR(256),                          -- from webhook `contacts[].profile.name`
  marketing_consent    BOOLEAN NOT NULL DEFAULT false,
  consent_source       consent_source,
  consent_updated_at   TIMESTAMPTZ,
  opted_out_at         TIMESTAMPTZ,
  opted_out_reason      TEXT,
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  attributes           JSONB NOT NULL DEFAULT '{}',            -- freeform CRM-style custom fields
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_wa_id ON contacts (wa_id);
CREATE INDEX idx_contacts_marketing_consent ON contacts (marketing_consent) WHERE marketing_consent = true;
CREATE INDEX idx_contacts_tags ON contacts USING GIN (tags);

-- ── CAMPAIGNS ────────────────────────────────────────────────────────────
-- Every MM Lite (and, optionally, bulk Cloud API) send is grouped under a
-- campaign for attribution, pacing, and reporting.

CREATE TABLE campaigns (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(256) NOT NULL,
  channel              message_channel NOT NULL DEFAULT 'mm_lite',
  template_name        VARCHAR(256) NOT NULL,
  template_language    VARCHAR(16) NOT NULL DEFAULT 'en_US',
  status               campaign_status NOT NULL DEFAULT 'draft',
  phone_number_id      VARCHAR(64) NOT NULL,                  -- Meta phone_number_id used to send
  target_count         INTEGER NOT NULL DEFAULT 0,
  queued_count         INTEGER NOT NULL DEFAULT 0,
  sent_count           INTEGER NOT NULL DEFAULT 0,
  delivered_count      INTEGER NOT NULL DEFAULT 0,
  read_count           INTEGER NOT NULL DEFAULT 0,
  replied_count        INTEGER NOT NULL DEFAULT 0,
  failed_count         INTEGER NOT NULL DEFAULT 0,
  scheduled_at         TIMESTAMPTZ,
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  pacing_per_second     INTEGER NOT NULL DEFAULT 20,           -- MM Lite throughput cap for this campaign
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_scheduled_at ON campaigns (scheduled_at) WHERE status = 'scheduled';

-- ── MESSAGES ─────────────────────────────────────────────────────────────
-- Every inbound and outbound message, regardless of channel. `wa_message_id`
-- is Meta's id (the `messages[].id` / `statuses[].id` from the webhook, or
-- the id returned synchronously by the send call) and is the join key used
-- for status-update correlation and dedupe.

CREATE TABLE messages (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_message_id        VARCHAR(128) UNIQUE,                   -- null until Meta assigns one (outbound pre-send)
  direction            message_direction NOT NULL,
  channel              message_channel NOT NULL,
  category             message_category NOT NULL,
  contact_id           UUID NOT NULL REFERENCES contacts (id) ON DELETE RESTRICT,
  campaign_id          UUID REFERENCES campaigns (id) ON DELETE SET NULL,
  conversation_id      UUID,                                  -- FK added after conversations table exists
  phone_number_id      VARCHAR(64) NOT NULL,
  status               message_status NOT NULL DEFAULT 'queued',
  message_type         VARCHAR(32) NOT NULL,                  -- text | template | interactive | button | image ...
  template_name        VARCHAR(256),
  payload              JSONB NOT NULL,                         -- full request/received payload, for replay/audit
  biz_opaque_callback_data VARCHAR(512),                       -- our own tracking token embedded on send
  context_message_id   VARCHAR(128),                           -- Meta `context.id` — the message this replies to
  error_code           VARCHAR(32),
  error_detail         JSONB,
  queued_at            TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  read_at              TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_wa_message_id ON messages (wa_message_id);
CREATE INDEX idx_messages_contact_id ON messages (contact_id);
CREATE INDEX idx_messages_campaign_id ON messages (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_messages_context_message_id ON messages (context_message_id) WHERE context_message_id IS NOT NULL;
CREATE INDEX idx_messages_biz_opaque ON messages (biz_opaque_callback_data) WHERE biz_opaque_callback_data IS NOT NULL;
CREATE INDEX idx_messages_status ON messages (status);
CREATE INDEX idx_messages_created_at ON messages (created_at);

-- ── CONVERSATIONS ────────────────────────────────────────────────────────
-- One row per rolling 24h customer-service window per contact. A new inbound
-- message (or a user-initiated reply to a marketing message) opens/extends
-- the window; `window_expires_at` is the authoritative "can we free-form
-- message this user" check before any Cloud API send.

CREATE TABLE conversations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id           UUID NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  wa_id                VARCHAR(32) NOT NULL,
  window_opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_expires_at    TIMESTAMPTZ NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  active_actor         conversation_actor NOT NULL DEFAULT 'bot',
  assigned_agent_id    UUID,
  origin_campaign_id   UUID REFERENCES campaigns (id) ON DELETE SET NULL,  -- attribution: which campaign opened this window
  origin_message_id    VARCHAR(128),                           -- the wa_message_id that triggered the window
  last_inbound_at      TIMESTAMPTZ,
  last_outbound_at     TIMESTAMPTZ,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A contact can have many historical conversation windows, but only one
-- currently-active one — enforced via a partial unique index rather than a
-- CHECK constraint, since "active" is time-dependent (see sessionService).
CREATE UNIQUE INDEX idx_conversations_one_active_per_contact
  ON conversations (contact_id) WHERE is_active = true;

CREATE INDEX idx_conversations_wa_id ON conversations (wa_id);
CREATE INDEX idx_conversations_window_expires_at ON conversations (window_expires_at) WHERE is_active = true;
CREATE INDEX idx_conversations_origin_campaign_id ON conversations (origin_campaign_id) WHERE origin_campaign_id IS NOT NULL;

ALTER TABLE messages
  ADD CONSTRAINT fk_messages_conversation
  FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE SET NULL;

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id) WHERE conversation_id IS NOT NULL;

-- ── WEBHOOK EVENT LOG ────────────────────────────────────────────────────
-- Append-only audit trail of every webhook delivery, independent of Redis
-- dedupe (which is TTL'd). Cheap insurance for replay/debugging.

CREATE TABLE webhook_events (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type           VARCHAR(32) NOT NULL,                  -- 'status' | 'inbound_message' | 'other'
  wa_message_id        VARCHAR(128),
  raw_payload          JSONB NOT NULL,
  processed_at         TIMESTAMPTZ,
  processing_error     TEXT,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_wa_message_id ON webhook_events (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX idx_webhook_events_received_at ON webhook_events (received_at);

-- ── updated_at triggers ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
