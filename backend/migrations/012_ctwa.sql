-- ============================================================================
-- 012_ctwa.sql
-- Click-to-WhatsApp ads: the ad referral carried by a customer's first message, and the
-- conversion events we sent back to Meta for it (Conversions API for Business Messaging)
-- ============================================================================

CREATE TABLE ctwa_referrals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_id            VARCHAR(30)  NOT NULL,
  contact_name     VARCHAR(200),
  ctwa_clid        VARCHAR(500),
  source_id        VARCHAR(100),
  source_type      VARCHAR(20),
  source_url       VARCHAR(1000),
  headline         VARCHAR(500),
  body             TEXT,
  media_type       VARCHAR(20),
  media_url        VARCHAR(2000),
  welcome_text     TEXT,
  wa_message_id    VARCHAR(200) NOT NULL UNIQUE,   -- Meta redelivers webhooks; the message id makes the insert idempotent
  phone_number_id  VARCHAR(50),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctwa_referrals_wa      ON ctwa_referrals (wa_id, created_at DESC);
CREATE INDEX idx_ctwa_referrals_created ON ctwa_referrals (created_at DESC);
CREATE INDEX idx_ctwa_referrals_source  ON ctwa_referrals (source_id);

CREATE TABLE ctwa_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id  UUID NOT NULL REFERENCES ctwa_referrals (id) ON DELETE CASCADE,
  event_name   VARCHAR(40) NOT NULL,
  value        NUMERIC(14, 2),
  currency     CHAR(3),
  status       VARCHAR(10) NOT NULL,               -- sent | failed
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctwa_events_referral ON ctwa_events (referral_id, created_at);
