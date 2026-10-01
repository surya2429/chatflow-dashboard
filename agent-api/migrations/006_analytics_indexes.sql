-- ============================================================================
-- 006_analytics_indexes.sql
-- Agent analytics reads messages by author and time, and resolutions by time
-- ============================================================================

-- Up Migration

CREATE INDEX idx_messages_agent_time ON messages (agent_id, created_at) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_messages_event_time ON messages (event, created_at) WHERE type = 'event';

-- Down Migration

DROP INDEX IF EXISTS idx_messages_event_time;
DROP INDEX IF EXISTS idx_messages_agent_time;
