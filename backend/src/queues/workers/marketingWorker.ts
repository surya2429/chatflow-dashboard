import { Worker, type Job } from 'bullmq'
import { redis } from '../../redis/client.js'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { marketingMessagesClient } from '../../whatsapp/marketingMessagesClient.js'
import { WhatsAppApiError, type CallbackToken } from '../../whatsapp/types.js'
import { messageRepository } from '../../db/repositories/messageRepository.js'
import { campaignRepository } from '../../db/repositories/campaignRepository.js'
import { contactRepository } from '../../db/repositories/contactRepository.js'
import type { MarketingSendJob } from '../jobTypes.js'
import { randomUUID } from 'node:crypto'
import { readTrackedLink, signLinkToken, withTrackedLink, type TrackedLinkConfig } from '../../marketing/trackedLink.js'

// A campaign's link settings are read once a minute, not once per message.
const linkCache = new Map<string, { cfg: TrackedLinkConfig | null; at: number }>()
async function trackedLinkOf(campaignId: string): Promise<TrackedLinkConfig | null> {
  const hit = linkCache.get(campaignId)
  if (hit && Date.now() - hit.at < 60_000) return hit.cfg
  const cfg = readTrackedLink((await campaignRepository.findById(campaignId))?.metadata)
  if (linkCache.size > 500) linkCache.clear()
  linkCache.set(campaignId, { cfg, at: Date.now() })
  return cfg
}

/**
 * Consumes `marketing-send` jobs and dispatches through the Marketing Messages API for WhatsApp.
 *
 * Two layers of pacing are deliberately stacked: BullMQ's `limiter` caps
 * how fast THIS process pulls jobs off Redis, while Meta itself paces
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
        // A campaign with a tracked link puts this message's signed token into the template's dynamic URL button,
        // so a tap on it tells us exactly who clicked (GET /r/:token).
        const link = await trackedLinkOf(campaignId)
        const sendable = link
          ? { ...template, components: withTrackedLink(template.components, link, signLinkToken(internalMessageId, env.WA_APP_SECRET)) }
          : template
        const result = await marketingMessagesClient.sendMarketingTemplate({ to: waId, template: sendable, callback })

        await messageRepository.createOutbound({
          id: internalMessageId,
          waMessageId: result.waMessageId,
          channel: 'mm_api',
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
        log.info({ waMessageId: result.waMessageId }, 'Marketing template sent via Marketing Messages API')
        return { waMessageId: result.waMessageId }
      } catch (err) {
        if (err instanceof WhatsAppApiError) {
          log.error({ err, isRateLimited: err.isRateLimited }, 'Marketing Messages API send failed')
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
