import { contactRepository } from '../db/repositories/contactRepository.js'
import { logger } from '../config/logger.js'

const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'opt out', 'optout'])
const OPT_IN_KEYWORDS = new Set(['start', 'subscribe', 'opt in', 'optin'])

/**
 * Meta requires businesses to honor STOP/UNSUBSCRIBE immediately — this
 * runs synchronously inside the InboundMessageWorker, before any bot/flow
 * logic touches the message, so a mistimed AI reply can never sneak a
 * marketing message out after a user has opted out in the same turn.
 */
export const optOutService = {
  matchesOptOut(text: string): boolean {
    return OPT_OUT_KEYWORDS.has(text.trim().toLowerCase())
  },

  matchesOptIn(text: string): boolean {
    return OPT_IN_KEYWORDS.has(text.trim().toLowerCase())
  },

  async handleOptOut(waId: string, rawText: string): Promise<void> {
    await contactRepository.setMarketingConsent(waId, false, 'inbound_message', `User sent "${rawText.trim()}"`)
    logger.info({ waId }, 'Marketing consent revoked via inbound opt-out keyword')
  },

  async handleOptIn(waId: string): Promise<void> {
    await contactRepository.setMarketingConsent(waId, true, 'inbound_message')
    logger.info({ waId }, 'Marketing consent granted via inbound opt-in keyword')
  },
}
