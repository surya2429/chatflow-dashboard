import { messageRepository } from '../db/repositories/messageRepository.js'
import { decodeCallbackToken } from '../whatsapp/types.js'

/** A reply that quotes nothing still counts for a campaign if it comes this soon after the campaign message reached the person. */
export const REPLY_ATTRIBUTION_HOURS = 72

export type AttributionVia = 'context' | 'callback' | 'window' | null

/**
 * Resolves "which marketing campaign does this inbound reply belong to."
 *
 * The Marketing Messages API is send-only, but replies and button taps come back through the normal webhook on the
 * same phone number, so they can all be attributed here. Tried in order, most certain first:
 *  1. `context.id` — set by WhatsApp when the person taps a quick-reply button or replies directly to a message.
 *     We look that message up in our `messages` table (indexed on `wa_message_id`) to get its `campaign_id`.
 *  2. `biz_opaque_callback_data` echoed back — decoded to pull the `campaignId` embedded at send time.
 *  3. Recency — people often just type an answer. The latest marketing message we sent that contact within
 *     REPLY_ATTRIBUTION_HOURS decides the campaign. Weaker than 1 and 2, so the caller can tell which one fired.
 *
 * Returns `null` when none resolves — a perfectly normal case for someone messaging the business number cold.
 */
export const attributionService = {
  async resolveCampaignId(params: {
    contextMessageId?: string | undefined
    bizOpaqueCallbackData?: string | undefined
    contactId?: string | undefined
  }): Promise<{ campaignId: string | null; originMessageId: string | null; via: AttributionVia }> {
    if (params.contextMessageId) {
      const original = await messageRepository.findByWaMessageId(params.contextMessageId)
      if (original?.campaign_id) {
        return { campaignId: original.campaign_id, originMessageId: original.wa_message_id, via: 'context' }
      }
    }

    const token = decodeCallbackToken(params.bizOpaqueCallbackData)
    if (token?.campaignId) {
      return { campaignId: token.campaignId, originMessageId: null, via: 'callback' }
    }

    // A reply that quotes some other message (e.g. an agent reply) is part of that conversation, not a campaign reply.
    if (params.contactId && !params.contextMessageId) {
      const recent = await messageRepository.findLatestMarketingToContact(params.contactId, REPLY_ATTRIBUTION_HOURS)
      if (recent?.campaign_id) return { campaignId: recent.campaign_id, originMessageId: recent.wa_message_id, via: 'window' }
    }

    return { campaignId: null, originMessageId: params.contextMessageId ?? null, via: null }
  },
}
