import { query } from '../pool.js'

export interface ClickInput {
  campaignId: string | null
  messageId: string | null
  contactId: string | null
  phoneNumberId: string
  source: 'redirect' | 'webhook'
  clickId: string | null
  clickComponent?: string | null | undefined
  productId?: string | null | undefined
  trackingToken?: string | null | undefined
  occurredAt: Date
}

const ATTRIBUTION_WINDOW_DAYS = 7 // Meta only reports clicks for messages sent in the last 7 days

export const clickRepository = {
  /**
   * One row per click. When Meta's webhook and our redirect report the same click_id they merge: the row keeps whatever
   * either side knew (the redirect knows the message and contact, the webhook knows the component and product).
   */
  async record(c: ClickInput): Promise<void> {
    await query(
      `INSERT INTO campaign_link_clicks
         (campaign_id, message_id, contact_id, phone_number_id, source, click_id, click_component, product_id, tracking_token, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (click_id) WHERE click_id IS NOT NULL DO UPDATE SET
         campaign_id     = COALESCE(campaign_link_clicks.campaign_id, EXCLUDED.campaign_id),
         message_id      = COALESCE(campaign_link_clicks.message_id, EXCLUDED.message_id),
         contact_id      = COALESCE(campaign_link_clicks.contact_id, EXCLUDED.contact_id),
         click_component = COALESCE(campaign_link_clicks.click_component, EXCLUDED.click_component),
         product_id      = COALESCE(campaign_link_clicks.product_id, EXCLUDED.product_id),
         tracking_token  = COALESCE(campaign_link_clicks.tracking_token, EXCLUDED.tracking_token),
         source          = CASE WHEN campaign_link_clicks.source = EXCLUDED.source THEN campaign_link_clicks.source ELSE 'both' END`,
      [c.campaignId, c.messageId, c.contactId, c.phoneNumberId, c.source, c.clickId, c.clickComponent ?? null, c.productId ?? null, c.trackingToken ?? null, c.occurredAt],
    )
  },

  /** Meta's click event names no recipient or message, so it is tied to a campaign only when exactly one was sent from this number in the window. */
  async campaignForWebhookClick(phoneNumberId: string): Promise<string | null> {
    const rows = await query<{ id: string }>(
      `SELECT DISTINCT campaign_id AS id FROM messages
       WHERE direction = 'outbound' AND category = 'marketing' AND campaign_id IS NOT NULL AND phone_number_id = $1
         AND created_at > now() - make_interval(days => $2)`,
      [phoneNumberId, ATTRIBUTION_WINDOW_DAYS],
    )
    return rows.length === 1 ? rows[0]!.id : null // several campaigns in the window: leave it unattributed rather than guess
  },
}
