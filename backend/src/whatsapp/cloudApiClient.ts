import { BaseWhatsAppClient } from './baseClient.js'
import {
  encodeCallbackToken,
  type SendResult,
  type SendTemplateRequest,
  type SendTextRequest,
} from './types.js'

/**
 * Standard Cloud API — `POST /{phone_number_id}/messages`.
 * Used for transactional, utility, authentication (OTP), and real-time
 * bot/agent replies. This is the fast lane: no batching, one call per
 * message, dispatched from `priorityQueue`.
 */
export class CloudApiClient extends BaseWhatsAppClient {
  async sendTemplate(req: SendTemplateRequest): Promise<SendResult> {
    return this.post('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: req.to,
      type: 'template',
      template: req.template,
      biz_opaque_callback_data: encodeCallbackToken(req.callback),
    })
  }

  async sendText(req: SendTextRequest): Promise<SendResult> {
    return this.post('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: req.to,
      type: 'text',
      text: { body: req.body, preview_url: req.previewUrl ?? false },
      ...(req.contextMessageId ? { context: { message_id: req.contextMessageId } } : {}),
      biz_opaque_callback_data: encodeCallbackToken(req.callback),
    })
  }

  /** Marks an inbound message as read — used by the bot/agent desk on open, not part of the send-side dispatch. */
  async markAsRead(waMessageId: string): Promise<void> {
    await this.postVoid('messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId,
    })
  }
}

export const cloudApiClient = new CloudApiClient()
