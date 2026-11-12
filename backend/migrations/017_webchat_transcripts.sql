-- 017_webchat_transcripts.sql — one shareable, no-login page per website-chat conversation (linked from the email notifications).
-- The token is the whole secret (24 random bytes), so it is never derived from anything guessable. One row per conversation:
-- publishing again refreshes the messages and the expiry but keeps the same link.
CREATE TABLE webchat_transcripts (
  token            CHAR(32) PRIMARY KEY,
  conversation_id  VARCHAR(100) NOT NULL UNIQUE,
  bot_name         VARCHAR(120) NOT NULL,
  visitor_name     VARCHAR(120) NOT NULL,
  messages         JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL
);
