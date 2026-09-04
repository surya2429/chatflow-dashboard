import { BaseWhatsAppClient } from './baseClient.js'
import { encodeCallbackToken, type SendResult, type SendTemplateRequest } from './types.js'

/**
 * WhatsApp Marketing Messages Lite API — `POST /{phone_number_id}/mm_lite`.
 * Purpose-built for high-volume marketing sends: Meta handles pacing
 * server-side, so our `marketingQueue` worker still self-throttles (see
 * `MARKETING_QUEUE_RATE_PER_SECOND`) to stay under Meta's own limits and
 * fail gracefully rather than relying solely on their backpressure.
 *
 * MM Lite currently only accepts pre-approved marketing templates — no
 * freeform text/interactive sends. Union that restriction into the type
 * rather than commenting it, so misuse is a compile error, not a 400.
 */
export class MmLiteClient extends BaseWhatsAppClient {
  async sendMarketingTemplate(req: Omit<SendTemplateRequest, 'category'>): Promise<SendResult> {
    return this.post('mm_lite', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: req.to,
      type: 'template',
      template: req.template,
      biz_opaque_callback_data: encodeCallbackToken(req.callback),
    })
  }
}

export const mmLiteClient = new MmLiteClient()
