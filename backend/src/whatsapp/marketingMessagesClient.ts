import { BaseWhatsAppClient } from './baseClient.js'
import { env } from '../config/env.js'
import type { SendResult, SendTemplateRequest } from './types.js'

/**
 * Marketing Messages API for WhatsApp — `POST /{phone_number_id}/marketing_messages`.
 * The successor to Cloud API marketing sends (Cloud API stops accepting marketing
 * messages on 13 Oct 2027; accounts created from 13 Apr 2027 cannot send them there at all)
 * and to the earlier Marketing Messages Lite endpoint. Same request shape as Cloud API,
 * same billing, existing phone numbers and approved marketing templates keep working;
 * Meta adds delivery optimisation. Status webhooks report `pricing.category = marketing_lite`.
 *
 * Meta paces delivery server-side, so our `marketingQueue` worker still self-throttles
 * (see `MARKETING_QUEUE_RATE_PER_SECOND`) to stay under Meta's limits and fail gracefully
 * rather than relying solely on their backpressure.
 *
 * Replies and button taps are NOT sent back on this API: it is send-only. They arrive on the normal Cloud API webhook
 * for the same phone number (see attributionService); link clicks come from our tracked link or Meta's click webhook.
 * `product_policy` defaults to CLOUD_API_FALLBACK on Meta's side: an account that is not onboarded is sent through
 * Cloud API instead of failing, and the status webhook (pricing.category) shows which happened.
 *
 * Only pre-approved marketing templates are accepted — no freeform text/interactive sends.
 * That restriction is in the type (templates only), so misuse is a compile error, not a 400.
 */
export class MarketingMessagesClient extends BaseWhatsAppClient {
  async sendMarketingTemplate(req: Omit<SendTemplateRequest, 'category'>): Promise<SendResult> {
    return this.post('marketing_messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: req.to,
      type: 'template',
      template: req.template,
      // biz_opaque_callback_data is not a documented field of this endpoint, so it is not sent: status webhooks are
      // matched to our rows by the message id in the send response, and replies by context.id.
      ...(env.MM_PRODUCT_POLICY ? { product_policy: env.MM_PRODUCT_POLICY } : {}),
      ...(env.MM_ACTIVITY_SHARING !== undefined ? { message_activity_sharing: env.MM_ACTIVITY_SHARING } : {}),
    })
  }
}

export const marketingMessagesClient = new MarketingMessagesClient()
