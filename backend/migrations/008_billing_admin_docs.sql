-- ============================================================================
-- 008_billing_admin_docs.sql
-- Small shared documents for the admin console: staff accounts and coupons
-- ============================================================================
CREATE TABLE billing_docs (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
