import { Worker, type Job } from 'bullmq'
import { redis } from '../../redis/client.js'
import { logger } from '../../config/logger.js'
import { contactRepository } from '../../db/repositories/contactRepository.js'
import { messageRepository } from '../../db/repositories/messageRepository.js'
import { campaignRepository } from '../../db/repositories/campaignRepository.js'
import { webhookEventRepository } from '../../db/repositories/webhookEventRepository.js'
import { sessionService } from '../../services/sessionService.js'
import { attributionService } from '../../services/attributionService.js'
import { optOutService } from '../../services/optOutService.js'
import { conversationRouter } from '../../services/conversationRouter.js'
import type { InboundMessageJob } from '../jobTypes.js'

/**
 * Consumes `inbound-message` jobs — every inbound text/button/interactive
 * message from a user. This is the seam where MM Lite campaign replies,
 * cold inbounds, and bot-flow input all converge into one pipeline:
 *
 *   1. Upsert the contact (profile name may have changed since last seen).
 *   2. Opt-out/opt-in keyword check — runs BEFORE anything else touches
 *      this message, so a "STOP" can never race a queued bot reply.
 *   3. Resolve campaign attribution via `context.id` / callback token.
 *   4. Open or extend the 24h service window, tagging it with the
 *      resolved campaign if this is the message that opened it.
 *   5. Persist the inbound message row.
 *   6. Bump `campaigns.replied_count` if attributed.
 *   7. Hand off to `conversationRouter` (bot flow / agent desk) — kept as
 *      a narrow interface here deliberately; this worker owns ingestion,
 *      not conversational logic.
 */
export function startInboundMessageWorker(): Worker<InboundMessageJob> {
  const worker = new Worker<InboundMessageJob>(
    'inbound-message',
    async (job: Job<InboundMessageJob>) => {
      const { waMessageId, from, phoneNumberId, type, profileName, contextMessageId, text } = job.data
      const log = logger.child({ queue: 'inbound-message', jobId: job.id, waMessageId, from })

      const contact = await contactRepository.upsertFromWebhook(from, from, profileName)

      if (type === 'text' && text) {
        if (optOutService.matchesOptOut(text)) {
          await optOutService.handleOptOut(from, text)
        } else if (optOutService.matchesOptIn(text)) {
          await optOutService.handleOptIn(from)
        }
      }

      const { campaignId, originMessageId } = await attributionService.resolveCampaignId({
        contextMessageId,
        bizOpaqueCallbackData: undefined, // inbound webhook payloads don't carry the outbound callback token directly; context.id is the primary signal
      })

      const conversation = await sessionService.openFromInboundMessage({
        contactId: contact.id,
        waId: from,
        originCampaignId: campaignId ?? undefined,
        originMessageId: originMessageId ?? undefined,
      })

      const message = await messageRepository.createInbound({
        waMessageId,
        contactId: contact.id,
        conversationId: conversation.id,
        phoneNumberId,
        messageType: type,
        payload: job.data.raw,
        contextMessageId,
      })

      if (!message) {
        log.info('Inbound message already recorded (duplicate delivery) — skipping downstream routing')
        await webhookEventRepository.markProcessed(waMessageId)
        return { duplicate: true }
      }

      if (campaignId) {
        await campaignRepository.incrementCounter(campaignId, 'replied_count')
      }

      await conversationRouter.handleInbound({
        conversationId: conversation.id,
        contactId: contact.id,
        waId: from,
        phoneNumberId,
        messageType: type,
        text,
        campaignId: campaignId ?? undefined,
      })

      await webhookEventRepository.markProcessed(waMessageId)
      log.info({ campaignId, conversationId: conversation.id }, 'Inbound message processed')
      return { processed: true }
    },
    { connection: redis, concurrency: 20 },
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'inbound-message job failed permanently')
  })

  return worker
}
