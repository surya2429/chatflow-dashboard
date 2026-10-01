-- ============================================================================
-- 007_notification_prefs.sql
-- Push on/off per device, and which kinds of push each person wants
-- ============================================================================

-- Up Migration

-- "Push notifications on this phone" — a device can be muted without
-- unregistering it, so turning it back on needs no new token.
ALTER TABLE devices ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT true;

-- Per person, across their devices: { assignments, messages, waiting, calls }.
-- A missing key means "on", so new categories default to on for everyone.
ALTER TABLE users ADD COLUMN notify_prefs JSONB NOT NULL DEFAULT '{}';

-- Down Migration

ALTER TABLE users DROP COLUMN IF EXISTS notify_prefs;
ALTER TABLE devices DROP COLUMN IF EXISTS push_enabled;
