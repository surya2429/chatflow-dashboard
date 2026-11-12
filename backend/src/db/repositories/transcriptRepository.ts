import { query } from '../pool.js'
import type { StoredTranscript, TranscriptInput, TranscriptMessage, TranscriptStore } from '../../transcripts/transcripts.js'

interface Row { token: string; bot_name: string; visitor_name: string; messages: TranscriptMessage[]; updated_at: Date }

export const transcriptRepository: TranscriptStore = {
  async save(t: TranscriptInput, token: string, expiresAt: Date): Promise<string> {
    // a conversation keeps the token it first got; only the messages and the expiry move
    const rows = await query<{ token: string }>(
      `INSERT INTO webchat_transcripts (token, conversation_id, bot_name, visitor_name, messages, expires_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (conversation_id) DO UPDATE
         SET bot_name = EXCLUDED.bot_name, visitor_name = EXCLUDED.visitor_name, messages = EXCLUDED.messages,
             expires_at = EXCLUDED.expires_at, updated_at = now()
       RETURNING token`,
      [token, t.conversationId, t.botName, t.visitorName, JSON.stringify(t.messages), expiresAt],
    )
    return rows[0]!.token
  },

  async find(token: string, now: Date): Promise<StoredTranscript | null> {
    const rows = await query<Row>(`SELECT * FROM webchat_transcripts WHERE token = $1 AND expires_at > $2`, [token, now])
    const r = rows[0]
    return r ? { botName: r.bot_name, visitorName: r.visitor_name, messages: r.messages, updatedAt: r.updated_at.toISOString() } : null
  },
}
