import { query } from '../pool.js'

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled'

export interface Campaign {
  id: string
  name: string
  channel: 'mm_api' | 'cloud_api'
  template_name: string
  template_language: string
  status: CampaignStatus
  phone_number_id: string
  target_count: number
  queued_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  replied_count: number
  failed_count: number
  pacing_per_second: number
  /** e.g. { trackedLink: { buttonIndex: 0, destination: 'https://shop.example.com/offer' } } — see src/marketing/trackedLink.ts */
  metadata: Record<string, unknown>
}

type CounterField = 'queued_count' | 'sent_count' | 'delivered_count' | 'read_count' | 'replied_count' | 'failed_count'

export const campaignRepository = {
  async findById(id: string): Promise<Campaign | null> {
    const rows = await query<Campaign>('SELECT * FROM campaigns WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async markStatus(id: string, status: CampaignStatus): Promise<void> {
    const timestampCol = status === 'sending' ? 'started_at' : status === 'completed' ? 'completed_at' : null
    await query(
      `UPDATE campaigns SET status = $2 ${timestampCol ? `, ${timestampCol} = now()` : ''} WHERE id = $1`,
      [id, status],
    )
  },

  /**
   * Atomic counter bump — called from the status-update worker on every
   * delivery/read/reply/failure event. Uses a single UPDATE ... increment
   * rather than read-modify-write to stay correct under concurrent workers.
   */
  async incrementCounter(id: string, field: CounterField, by = 1): Promise<void> {
    // field is from a closed enum above, never user input — safe to interpolate the column name.
    await query(`UPDATE campaigns SET ${field} = ${field} + $2 WHERE id = $1`, [id, by])
  },

  /**
   * What a marketing campaign earned: delivery, replies (people, not messages), button taps, link clicks, and which API
   * actually carried the messages. The Marketing Messages API is send-only, so everything after "delivered" is gathered
   * from the normal webhook (replies, button taps), our tracked link and Meta's click event (link clicks).
   */
  async engagement(id: string): Promise<CampaignEngagement | null> {
    const rows = await query<CampaignEngagement>(
      `SELECT c.id, c.name, c.status,
              c.sent_count      AS "sent",      c.delivered_count AS "delivered", c.read_count AS "read",
              c.failed_count    AS "failed",    c.replied_count   AS "repliedPeople",
              (SELECT COUNT(*)::int FROM messages m WHERE m.campaign_id = c.id AND m.direction = 'inbound')                         AS "replyMessages",
              (SELECT COUNT(*)::int FROM messages m WHERE m.campaign_id = c.id AND m.direction = 'inbound' AND m.message_type = 'button') AS "buttonTaps",
              (SELECT COUNT(*)::int FROM campaign_link_clicks k WHERE k.campaign_id = c.id)                                          AS "linkClicks",
              (SELECT COUNT(DISTINCT k.contact_id)::int FROM campaign_link_clicks k WHERE k.campaign_id = c.id)                       AS "linkClickers",
              (SELECT COUNT(*)::int FROM messages m WHERE m.campaign_id = c.id AND m.direction = 'outbound' AND m.channel = 'mm_api') AS "sentViaMarketingApi",
              (SELECT COUNT(*)::int FROM messages m WHERE m.campaign_id = c.id AND m.direction = 'outbound' AND m.channel = 'cloud_api') AS "sentViaCloudApi"
       FROM campaigns c WHERE c.id = $1`,
      [id],
    )
    return rows[0] ?? null
  },
}

export interface CampaignEngagement {
  id: string; name: string; status: CampaignStatus
  sent: number; delivered: number; read: number; failed: number
  repliedPeople: number; replyMessages: number; buttonTaps: number
  linkClicks: number; linkClickers: number
  sentViaMarketingApi: number; sentViaCloudApi: number
}
