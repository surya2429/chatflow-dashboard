import { env } from '../config/env.js'
import { conversationRepository, type Conversation } from '../db/repositories/conversationRepository.js'

/**
 * Owns the 24h customer-service-window rule that governs when we're
 * allowed to freeform-message a user via the Cloud API (vs. being
 * restricted to sending an approved template to re-engage them).
 * Every inbound message, and every user-initiated reply to an MM Lite
 * marketing send, opens or extends this window — that's the single
 * source of truth callers should go through instead of touching
 * `conversationRepository` directly.
 */
export const sessionService = {
  async isWithinServiceWindow(contactId: string): Promise<boolean> {
    const active = await conversationRepository.findActiveByContactId(contactId)
    return active !== null
  },

  async getActiveConversation(contactId: string): Promise<Conversation | null> {
    return conversationRepository.findActiveByContactId(contactId)
  },

  /** Inbound message (freeform text, button reply, interactive reply) from the user. */
  async openFromInboundMessage(params: {
    contactId: string
    waId: string
    originCampaignId?: string | undefined
    originMessageId?: string | undefined
  }): Promise<Conversation> {
    return conversationRepository.openOrExtendWindow({
      contactId: params.contactId,
      waId: params.waId,
      windowHours: env.SERVICE_WINDOW_HOURS,
      originCampaignId: params.originCampaignId,
      originMessageId: params.originMessageId,
      lastInbound: true,
    })
  },

  /** We sent something inside an already-open window (bot/agent reply) — extends last_outbound_at only. */
  async recordOutboundActivity(params: { contactId: string; waId: string }): Promise<Conversation> {
    return conversationRepository.openOrExtendWindow({
      contactId: params.contactId,
      waId: params.waId,
      windowHours: env.SERVICE_WINDOW_HOURS,
      lastInbound: false,
    })
  },

  async handoffToHuman(conversationId: string, agentId: string): Promise<void> {
    await conversationRepository.setActor(conversationId, 'human', agentId)
  },

  async handoffToBot(conversationId: string): Promise<void> {
    await conversationRepository.setActor(conversationId, 'bot')
  },

  /** Run on an interval (see worker.ts) — cheap sweep, the read-path also filters on `window_expires_at > now()`. */
  async sweepExpiredWindows(): Promise<number> {
    return conversationRepository.closeExpiredWindows()
  },
}
