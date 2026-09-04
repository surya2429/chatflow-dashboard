import { messageRepository } from '../db/repositories/messageRepository.js'
import { decodeCallbackToken } from '../whatsapp/types.js'

/**
 * Resolves "which MM Lite campaign does this inbound reply belong to."
 *
 * Two paths, tried in order:
 *  1. `context.id` on the inbound webhook payload — set by WhatsApp when the
 *     user taps a button/quick-reply on a specific message, or replies
 *     directly to it. We look that message id up in our own `messages`
 *     table (indexed on `wa_message_id`) to get its `campaign_id`.
 *  2. `biz_opaque_callback_data` echoed back — decoded to pull the
 *     `campaignId` we embedded at send time. Used as a fallback for clients
 *     that surface the callback token on the reply rather than `context`.
 *
 * Returns `null` when neither resolves — a perfectly normal case for a
 * fresh inbound conversation with no prior outbound message (e.g. someone
 * messaging the business number cold).
 */
export const attributionService = {
  async resolveCampaignId(params: {
    contextMessageId?: string | undefined
    bizOpaqueCallbackData?: string | undefined
  }): Promise<{ campaignId: string | null; originMessageId: string | null }> {
    if (params.contextMessageId) {
      const original = await messageRepository.findByWaMessageId(params.contextMessageId)
      if (original?.campaign_id) {
        return { campaignId: original.campaign_id, originMessageId: original.wa_message_id }
      }
    }

    const token = decodeCallbackToken(params.bizOpaqueCallbackData)
    if (token?.campaignId) {
      return { campaignId: token.campaignId, originMessageId: null }
    }

    return { campaignId: null, originMessageId: params.contextMessageId ?? null }
  },
}
