import { query } from '../pool.js'

export const webhookEventRepository = {
  /** Fire-and-forget audit insert — never awaited on the hot webhook-ack path. */
  async log(eventType: 'status' | 'inbound_message' | 'other', waMessageId: string | null, rawPayload: unknown): Promise<void> {
    await query(
      `INSERT INTO webhook_events (event_type, wa_message_id, raw_payload) VALUES ($1, $2, $3)`,
      [eventType, waMessageId, JSON.stringify(rawPayload)],
    )
  },

  async markProcessed(waMessageId: string, error?: string): Promise<void> {
    await query(
      `UPDATE webhook_events
       SET processed_at = now(), processing_error = $2
       WHERE wa_message_id = $1 AND processed_at IS NULL`,
      [waMessageId, error ?? null],
    )
  },
}
