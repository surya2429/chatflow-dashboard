-- 015_campaign_link_clicks.sql — link clicks on marketing messages.
-- Two sources feed one row per click:
--   'redirect'  our own tracked link (GET /r/:token): exact — we know the message, campaign and contact
--   'webhook'   Meta's `marketing_messages_link_click` event: carries no recipient or message id, so it is attributed
--               to a campaign only when that is unambiguous (see clickRepository.campaignForWebhookClick)
-- Meta appends the same click_id to the URL the person opens, so a webhook row and a redirect row for one click
-- meet on click_id and are merged into a single row instead of being counted twice.
CREATE TABLE campaign_link_clicks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id      UUID REFERENCES campaigns (id) ON DELETE SET NULL,
  message_id       UUID REFERENCES messages (id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts (id) ON DELETE SET NULL,
  phone_number_id  VARCHAR(64) NOT NULL,
  source           VARCHAR(16) NOT NULL,                  -- redirect | webhook | both
  click_id         VARCHAR(256),
  click_component  VARCHAR(16),                           -- cta | body (webhook only)
  product_id       VARCHAR(128),
  tracking_token   VARCHAR(256),
  occurred_at      TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_campaign_link_clicks_click_id ON campaign_link_clicks (click_id) WHERE click_id IS NOT NULL;
CREATE INDEX idx_campaign_link_clicks_campaign ON campaign_link_clicks (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_campaign_link_clicks_phone_time ON campaign_link_clicks (phone_number_id, occurred_at);

-- Replies are stored with their campaign, so unique repliers and button taps can be counted per campaign.
CREATE INDEX idx_messages_inbound_campaign ON messages (campaign_id, contact_id) WHERE direction = 'inbound' AND campaign_id IS NOT NULL;
