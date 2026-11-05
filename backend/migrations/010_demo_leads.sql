-- ============================================================================
-- 010_demo_leads.sql
-- Leads from the "Powered by SmatBot" form in the WhatsApp website widget
-- ============================================================================

CREATE TABLE demo_leads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(254) NOT NULL,
  phone       VARCHAR(30)  NOT NULL,
  company     VARCHAR(120),
  website     VARCHAR(200),
  source_url  VARCHAR(500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_leads_created ON demo_leads (created_at DESC);
