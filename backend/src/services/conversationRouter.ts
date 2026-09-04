import { logger } from '../config/logger.js'
import { priorityQueue } from '../queues/queues.js'

export interface InboundRoutingContext {
  conversationId: string
  contactId: string
  waId: string
  phoneNumberId: string
  messageType: string
  text?: string | undefined
  campaignId?: string | undefined
}

/**
 * Deliberately narrow seam between raw ingestion (`inboundMessageWorker`)
 * and actual conversational logic (bot flow engine / agent desk), which
 * live outside this backend's scope. Swap `handleInbound`'s body for a
 * call into your flow engine, or push a job onto a `bot-flow` queue for a
 * separate worker to pick up — either way, ingestion stays decoupled from
 * "what do we say back."
 *
 * The one thing implemented here for real: a same-turn acknowledgment
 * reply for messages that just opened a *new* window from a marketing
 * campaign, since leaving a fresh MM Lite responder in silence until a
 * bot engine catches up is a common cause of drop-off in production.
 */
export const conversationRouter = {
  async handleInbound(ctx: InboundRoutingContext): Promise<void> {
    logger.info(
      { conversationId: ctx.conversationId, campaignId: ctx.campaignId, messageType: ctx.messageType },
      'Routing inbound message — plug bot flow engine / agent desk in here',
    )

    if (ctx.campaignId) {
      await priorityQueue.add('campaign-reply-ack', {
        contactId: ctx.contactId,
        waId: ctx.waId,
        phoneNumberId: ctx.phoneNumberId,
        category: 'service',
        campaignId: ctx.campaignId,
        conversationId: ctx.conversationId,
        payload: {
          kind: 'text',
          body: "Thanks for getting back to us! Someone from our team (or our assistant) will pick this up right away.",
        },
      })
    }
  },
}
