-- ============================================================================
-- 009_billing_usage.sql
-- What each customer has used, per day (IST) and metric — compared with their
-- plan's allowances in the dashboard and the admin console
-- ============================================================================
CREATE TABLE billing_usage (
  workspace_id TEXT   NOT NULL,
  day          DATE   NOT NULL,
  metric       TEXT   NOT NULL,          -- wa_service | wa_bi | web_chats | chatbots … (see billing/catalog.ts METRICS)
  value        BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, day, metric)
);

CREATE INDEX billing_usage_day_idx ON billing_usage (day);

-- Sent WhatsApp messages are matched to a client by the sending number (billing/usageSql.ts).
CREATE INDEX billing_records_wa_numbers_idx ON billing_records USING GIN ((data->'whatsappNumbers'));
