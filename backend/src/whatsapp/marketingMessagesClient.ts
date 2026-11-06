import { BaseWhatsAppClient } from './baseClient.js'
import { encodeCallbackToken, type SendResult, type SendTemplateRequest } from './types.js'

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
      biz_opaque_callback_data: encodeCallbackToken(req.callback),
    })
  }
}

export const marketingMessagesClient = new MarketingMessagesClient()
