-- ============================================================================
-- 004_bot_config_versioning.sql
-- Server-held widget config + a version to push and order changes by
-- ============================================================================

-- `bots.config` (003) is the merchant's flow/design/behaviour settings. Until
-- now the dashboard kept them in its own localStorage, which cannot work for a
-- widget installed on someone else's website: that widget runs in a VISITOR's
-- browser, where the merchant's localStorage does not exist. Config has to
-- live here to reach it at all — real-time is the second problem, not the
-- first.
--
-- `config_version` increments on every write. Clients hold the last version
-- they applied and ignore anything not newer, which makes the live stream
-- idempotent and safe to replay: a reconnect that redelivers an old event, or
-- two events arriving out of order, cannot roll a widget backwards.
ALTER TABLE bots
  ADD COLUMN config_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN config_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Bumping the version is the database's job, not the caller's: an UPDATE that
-- forgets to increment it would publish a change no client accepts, and two
-- concurrent writers computing version+1 in application code would both write
-- the same number. Doing it in a trigger means every path — API, migration,
-- manual psql — gets it right.
CREATE OR REPLACE FUNCTION bump_bot_config_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.config IS DISTINCT FROM OLD.config THEN
    NEW.config_version := OLD.config_version + 1;
    NEW.config_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bots_config_version BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION bump_bot_config_version();
