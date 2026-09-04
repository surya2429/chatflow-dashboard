import { Worker, type Job } from 'bullmq'
import { randomUUID } from 'node:crypto'
import { redis } from '../../redis/client.js'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { cloudApiClient } from '../../whatsapp/cloudApiClient.js'
import { WhatsAppApiError, type CallbackToken } from '../../whatsapp/types.js'
import { messageRepository } from '../../db/repositories/messageRepository.js'
import { sessionService } from '../../services/sessionService.js'
import type { PrioritySendJob } from '../jobTypes.js'

/**
 * Fast lane — OTPs, transactional alerts, and bot/agent replies via the
 * standard Cloud API. High concurrency, short backoff: these are
 * latency-sensitive (a user waiting on an OTP does not want an
 * exponential-backoff retry loop) but Meta's own transient 5xx/429s still
 * need at least a couple of retries rather than failing a login flow on
 * one blip.
 *
 * For `category: 'service'` sends (bot/agent freeform replies), we verify
 * the 24h window is still open right before dispatch — a queued job can
 * sit for seconds to minutes under load, long enough in edge cases for a
 * borderline-expired window to actually expire before we send.
 */
export function startPriorityWorker(): Worker<PrioritySendJob> {
  const worker = new Worker<PrioritySendJob>(
    'priority-send',
    async (job: Job<PrioritySendJob>) => {
      const { contactId, waId, phoneNumberId, category, campaignId, conversationId, contextMessageId, payload } = job.data
      const log = logger.child({ queue: 'priority-send', jobId: job.id, waId, category })

      if (category === 'service' && payload.kind === 'text') {
        const withinWindow = await sessionService.isWithinServiceWindow(contactId)
        if (!withinWindow) {
          log.warn('Dropping freeform service reply — 24h window has closed; re-engage with a template instead')
          return { skipped: true, reason: 'window_closed' }
        }
      }

      const internalMessageId = randomUUID()
      const callback: CallbackToken = { messageId: internalMessageId, campaignId }

      try {
        const result =
          payload.kind === 'template'
            ? await cloudApiClient.sendTemplate({ to: waId, template: payload.template, category, callback })
            : await cloudApiClient.sendText({
                to: waId,
                body: payload.body,
                previewUrl: payload.previewUrl,
                contextMessageId,
                callback,
              })

        await messageRepository.createOutbound({
          waMessageId: result.waMessageId,
          channel: 'cloud_api',
          category,
          contactId,
          campaignId,
          conversationId,
          phoneNumberId,
          messageType: payload.kind,
          templateName: payload.kind === 'template' ? payload.template.name : undefined,
          payload: payload as unknown as Record<string, unknown>,
          bizOpaqueCallbackData: JSON.stringify(callback),
        })

        if (conversationId) {
          await sessionService.recordOutboundActivity({ contactId, waId })
        }

        log.info({ waMessageId: result.waMessageId }, 'Cloud API message sent')
        return { waMessageId: result.waMessageId }
      } catch (err) {
        if (err instanceof WhatsAppApiError) {
          log.error({ err, isRateLimited: err.isRateLimited, isOutsideWindow: err.isOutsideServiceWindow }, 'Cloud API send failed')
          if (err.isRateLimited) throw err
          if (err.isOutsideServiceWindow) return { skipped: true, reason: 'window_closed' }
        }
        throw err
      }
    },
    {
      connection: redis,
      concurrency: env.PRIORITY_QUEUE_CONCURRENCY,
    },
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'priority-send job failed permanently')
  })

  return worker
}
