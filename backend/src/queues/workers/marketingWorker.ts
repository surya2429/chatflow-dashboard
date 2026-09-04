import { Worker, type Job } from 'bullmq'
import { redis } from '../../redis/client.js'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { mmLiteClient } from '../../whatsapp/mmLiteClient.js'
import { WhatsAppApiError, type CallbackToken } from '../../whatsapp/types.js'
import { messageRepository } from '../../db/repositories/messageRepository.js'
import { campaignRepository } from '../../db/repositories/campaignRepository.js'
import { contactRepository } from '../../db/repositories/contactRepository.js'
import type { MarketingSendJob } from '../jobTypes.js'
import { randomUUID } from 'node:crypto'

/**
 * Consumes `marketing-send` jobs and dispatches through MM Lite.
 *
 * Two layers of pacing are deliberately stacked: BullMQ's `limiter` caps
 * how fast THIS process pulls jobs off Redis, while MM Lite itself paces
 * delivery on Meta's side. If Meta responds 429 / rate-limit error anyway,
 * we throw and let BullMQ's exponential backoff retry — no manual sleep
 * loops, no busy-waiting.
 *
 * A hard-opt-out check runs immediately before every send, not just at
 * campaign-build time: consent can be revoked mid-campaign by an inbound
 * "STOP" processed by `inboundMessageWorker` while this job sits queued.
 */
export function startMarketingWorker(): Worker<MarketingSendJob> {
  const worker = new Worker<MarketingSendJob>(
    'marketing-send',
    async (job: Job<MarketingSendJob>) => {
      const { campaignId, contactId, waId, phoneNumberId, template } = job.data
      const log = logger.child({ queue: 'marketing-send', jobId: job.id, campaignId, waId })

      const contact = await contactRepository.findByWaId(waId)
      if (!contact || !contact.marketing_consent) {
        log.warn('Skipping send — contact has no active marketing consent (opted out mid-flight)')
        await campaignRepository.incrementCounter(campaignId, 'failed_count')
        return { skipped: true, reason: 'no_consent' }
      }

      const internalMessageId = randomUUID()
      const callback: CallbackToken = { messageId: internalMessageId, campaignId }

      try {
        const result = await mmLiteClient.sendMarketingTemplate({ to: waId, template, callback })

        await messageRepository.createOutbound({
          waMessageId: result.waMessageId,
          channel: 'mm_lite',
          category: 'marketing',
          contactId,
          campaignId,
          phoneNumberId,
          messageType: 'template',
          templateName: template.name,
          payload: template as unknown as Record<string, unknown>,
          bizOpaqueCallbackData: JSON.stringify(callback),
        })

        await campaignRepository.incrementCounter(campaignId, 'sent_count')
        log.info({ waMessageId: result.waMessageId }, 'Marketing template sent via MM Lite')
        return { waMessageId: result.waMessageId }
      } catch (err) {
        if (err instanceof WhatsAppApiError) {
          log.error({ err, isRateLimited: err.isRateLimited }, 'MM Lite send failed')
          if (err.isRateLimited) throw err // let BullMQ retry with backoff
          await campaignRepository.incrementCounter(campaignId, 'failed_count')
          return { skipped: true, reason: 'permanent_error', message: err.message }
        }
        throw err
      }
    },
    {
      connection: redis,
      concurrency: env.MARKETING_QUEUE_CONCURRENCY,
      limiter: { max: env.MARKETING_QUEUE_RATE_PER_SECOND, duration: 1000 },
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'marketing-send job failed permanently')
  })

  return worker
}
