import { query, withTransaction } from '../pool.js'

export type ConversationActor = 'bot' | 'human' | 'unassigned'

export interface Conversation {
  id: string
  contact_id: string
  wa_id: string
  window_opened_at: string
  window_expires_at: string
  is_active: boolean
  active_actor: ConversationActor
  assigned_agent_id: string | null
  origin_campaign_id: string | null
  origin_message_id: string | null
  last_inbound_at: string | null
  last_outbound_at: string | null
}

export const conversationRepository = {
  async findActiveByContactId(contactId: string): Promise<Conversation | null> {
    const rows = await query<Conversation>(
      `SELECT * FROM conversations WHERE contact_id = $1 AND is_active = true AND window_expires_at > now()`,
      [contactId],
    )
    return rows[0] ?? null
  },

  /**
   * Opens a fresh 24h window, or extends the existing active one, for a
   * contact. Runs inside a transaction with a row lock so two concurrent
   * inbound-message workers processing near-simultaneous messages from the
   * same user can't both try to insert an "active" row and trip the
   * partial-unique-index constraint.
   */
  async openOrExtendWindow(params: {
    contactId: string
    waId: string
    windowHours: number
    originCampaignId?: string | undefined
    originMessageId?: string | undefined
    lastInbound?: boolean
  }): Promise<Conversation> {
    return withTransaction(async (client) => {
      const existing = await client.query<Conversation>(
        `SELECT * FROM conversations WHERE contact_id = $1 AND is_active = true FOR UPDATE`,
        [params.contactId],
      )

      const expiresAt = `now() + interval '${params.windowHours} hours'`

      if (existing.rows[0]) {
        const updated = await client.query<Conversation>(
          `UPDATE conversations
           SET window_expires_at = ${expiresAt},
               last_inbound_at = CASE WHEN $2 THEN now() ELSE last_inbound_at END,
               last_outbound_at = CASE WHEN NOT $2 THEN now() ELSE last_outbound_at END
           WHERE id = $1
           RETURNING *`,
          [existing.rows[0].id, params.lastInbound ?? true],
        )
        return updated.rows[0] as Conversation
      }

      const inserted = await client.query<Conversation>(
        `INSERT INTO conversations
           (contact_id, wa_id, window_expires_at, origin_campaign_id, origin_message_id, last_inbound_at)
         VALUES ($1, $2, ${expiresAt}, $3, $4, now())
         RETURNING *`,
        [params.contactId, params.waId, params.originCampaignId ?? null, params.originMessageId ?? null],
      )
      return inserted.rows[0] as Conversation
    })
  },

  async setActor(conversationId: string, actor: ConversationActor, agentId?: string): Promise<void> {
    await query(
      `UPDATE conversations SET active_actor = $2, assigned_agent_id = $3 WHERE id = $1`,
      [conversationId, actor, agentId ?? null],
    )
  },

  /** Sweeps windows past expiry — run on a schedule (see worker.ts) since we don't rely solely on the read-time filter. */
  async closeExpiredWindows(): Promise<number> {
    const rows = await query<{ id: string }>(
      `UPDATE conversations SET is_active = false WHERE is_active = true AND window_expires_at <= now() RETURNING id`,
    )
    return rows.length
  },
}
