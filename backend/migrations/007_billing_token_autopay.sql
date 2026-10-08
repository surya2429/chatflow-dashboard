-- ============================================================================
-- 007_billing_token_autopay.sql
-- Flag the records on token (saved-card) autopay so the renewal job can find them
-- ============================================================================
ALTER TABLE billing_records ADD COLUMN token_autopay BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX billing_records_token_autopay_idx ON billing_records (workspace_id) WHERE token_autopay;
