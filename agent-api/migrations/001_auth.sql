-- ============================================================================
-- 001_auth.sql
-- Real staff accounts, sessions and presence — replaces the dashboard's
-- hardcoded DEMO_USERS array (src/context/AuthContext.jsx)
-- Target: PostgreSQL 14+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The three roles the dashboard already has. Until now they only decided which
-- nav items were visible; here they are what the server authorizes against on
-- every request (see src/auth/policy.ts).
CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'agent');

-- Server-tracked, and read by routing and push dispatch. This replaces the
-- dashboard's "Go Online (as Agent)" toggle, which was local UI state only.
CREATE TYPE agent_presence AS ENUM ('online', 'away', 'offline');

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(320) NOT NULL,
  -- scrypt, self-describing: "scrypt$N$r$p$salt$hash" (see src/auth/password.ts).
  password_hash         TEXT NOT NULL,
  name                  VARCHAR(256) NOT NULL,
  initials              VARCHAR(4) NOT NULL,
  color                 VARCHAR(16) NOT NULL DEFAULT '#0066ff',
  role                  user_role NOT NULL DEFAULT 'agent',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  presence              agent_presence NOT NULL DEFAULT 'offline',
  presence_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Refreshed by the app's heartbeat while it's in the foreground. An agent
  -- marked online whose phone went quiet is demoted to away by the sweeper,
  -- so a dead phone stops receiving auto-assigned chats.
  last_heartbeat_at     TIMESTAMPTZ,
  -- Upper bound on open ('agent'-status) conversations auto-assignment will
  -- give this person. Manual transfers ignore it.
  max_concurrent        INTEGER NOT NULL DEFAULT 5 CHECK (max_concurrent >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness without the citext extension.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_presence ON users (presence) WHERE is_active = true;

-- ── REFRESH TOKENS ───────────────────────────────────────────────────────
-- Long-lived, rotated on every use. Each login starts a `family`; every
-- rotation revokes the presented token and issues its successor in the same
-- family. If an already-rotated token is ever presented again, someone other
-- than the legitimate client holds a copy of it — the whole family is revoked,
-- which logs out both the attacker and the device it was stolen from.
--
-- Only a SHA-256 of the token is stored: a database leak must not hand out
-- working sessions.
CREATE TABLE refresh_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  family_id             UUID NOT NULL,
  token_hash            CHAR(64) NOT NULL UNIQUE,
  -- The app's installation id, so "log out this device" and push-token
  -- cleanup can target one phone without touching the user's others.
  device_id             VARCHAR(128),
  user_agent            TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ,
  revoked_reason        VARCHAR(32),               -- rotated | logout | reuse_detected | admin
  replaced_by           UUID REFERENCES refresh_tokens (id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
