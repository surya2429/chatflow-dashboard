-- ============================================================================
-- 006_billing_invoices_dunning.sql
-- Gapless invoice numbering and a flag for "who is in dunning"
-- ============================================================================

-- GST invoices need a unique, consecutive serial number across ALL customers, not
-- per workspace. One row per series (e.g. "inv:2026-27"), bumped in a single atomic
-- statement by pgStore.nextSequence.
CREATE TABLE billing_counters (
  key   TEXT PRIMARY KEY,
  value BIGINT NOT NULL
);

-- The dunning job only needs the records still being collected on.
ALTER TABLE billing_records ADD COLUMN in_dunning BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX billing_records_dunning_idx ON billing_records (workspace_id) WHERE in_dunning;
