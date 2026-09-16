-- ============================================================================
-- 003_clients_and_bots.sql
-- Clients (tenants) and their bots, with a globally sequential bot number
-- ============================================================================

-- ── CLIENTS ──────────────────────────────────────────────────────────────
-- One row per customer account. Bots belong to a client; the bot NUMBER does
-- not — see the sequence below.

CREATE TABLE clients (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(256) NOT NULL,
  archived_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_active ON clients (archived_at) WHERE archived_at IS NULL;

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── BOT NUMBER SEQUENCE ──────────────────────────────────────────────────
-- ONE sequence for the whole platform, deliberately not per-client:
--
--   client 1 → bot 1
--   client 2 → bot 2
--   client 1 → bot 3      ← client 1's second bot, but the platform's third
--   client 3 → bot 4
--
-- so the number says when a bot was created across the whole database, never
-- "which bot of this client's" it is. A per-client counter would hand two
-- different clients the same number and stop the id identifying a bot on its
-- own, which is the entire point of putting it in an install snippet.
--
-- OWNED BY ties the sequence's lifetime to the column, so dropping the table
-- drops this too rather than leaving an orphan behind.
--
-- Two properties worth being precise about:
--
--   * Unique and increasing — guaranteed. Concurrent inserts never collide,
--     because nextval() hands out each value exactly once without taking a
--     lock other writers have to wait behind.
--   * Gapless — NOT guaranteed, and cannot be from a sequence. nextval() is
--     non-transactional by design: a transaction that consumes a number and
--     then rolls back does not give it back, so a failed bot creation burns
--     one. That is the right trade here (a missing #37 is invisible to
--     customers, whereas the alternative below is not), but if numbering must
--     be provably contiguous, the only way is to serialize every creation
--     against a counter row —
--         UPDATE bot_counter SET n = n + 1 RETURNING n
--     which holds a row lock for the rest of the transaction and makes bot
--     creation platform-wide single-file.
--
-- START WITH 1 matches the spec literally. Note that a customer holding bot
-- #4 can infer the platform has created four bots, and can measure growth by
-- creating a second bot later and diffing. If that matters, START WITH a
-- larger offset (e.g. 10000) — the property being relied on is ordering, not
-- the absolute value.
CREATE SEQUENCE bot_number_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;

-- ── BOTS ─────────────────────────────────────────────────────────────────
-- `id` stays a UUID like every other table here: it is what foreign keys and
-- internal references should point at, and it is safe to generate offline or
-- merge across databases. `bot_number` is the human-facing identifier — the
-- one in the install snippet, the landing page URL and support tickets —
-- which is exactly why it is short, numeric, and NOT the primary key.

CREATE TABLE bots (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_number           BIGINT NOT NULL UNIQUE DEFAULT nextval('bot_number_seq'),
  client_id            UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name                 VARCHAR(256) NOT NULL,
  channel              VARCHAR(32) NOT NULL DEFAULT 'webchat',
  config               JSONB NOT NULL DEFAULT '{}',   -- widget appearance/behaviour
  archived_at          TIMESTAMPTZ,                   -- soft-delete: the number is never reused
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE bot_number_seq OWNED BY bots.bot_number;

-- The install snippet arrives as ?id=<bot_number> on every widget load, so
-- this lookup is the hottest read on the table. UNIQUE above already creates
-- an index for it; the two below serve the dashboard's own queries.
CREATE INDEX idx_bots_client_id ON bots (client_id);
CREATE INDEX idx_bots_active ON bots (archived_at) WHERE archived_at IS NULL;

CREATE TRIGGER trg_bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
