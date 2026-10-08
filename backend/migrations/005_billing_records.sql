-- ============================================================================
-- 005_billing_records.sql
-- One row per workspace: the plan they are on and its Razorpay state
-- ============================================================================

-- The record (plan, period, one-time vs autopay, status, renewal dates, payment
-- ledger) is stored as JSON and read/written as a unit. The two subscription id
-- columns exist only so a Razorpay webhook can find its workspace by id.
CREATE TABLE billing_records (
  workspace_id             TEXT PRIMARY KEY,
  subscription_id          TEXT,
  upcoming_subscription_id TEXT,
  data                     JSONB NOT NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX billing_records_subscription_idx ON billing_records (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX billing_records_upcoming_idx ON billing_records (upcoming_subscription_id) WHERE upcoming_subscription_id IS NOT NULL;
