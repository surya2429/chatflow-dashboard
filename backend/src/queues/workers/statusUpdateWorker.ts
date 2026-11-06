import { Worker, type Job } from 'bullmq'
import { redis } from '../../redis/client.js'
import { agentDeskClient } from '../../services/agentDeskClient.js'
import { logger } from '../../config/logger.js'
import { messageRepository } from '../../db/repositories/messageRepository.js'
import { campaignRepository } from '../../db/repositories/campaignRepository.js'
import { webhookEventRepository } from '../../db/repositories/webhookEventRepository.js'
import type { StatusUpdateJob } from '../jobTypes.js'

const COUNTER_BY_STATUS = {
  sent: 'sent_count',
  delivered: 'delivered_count',
  read: 'read_count',
  failed: 'failed_count',
} as const

/**
 * Consumes `status-update` jobs — the `sent` / `delivered` / `read` /
 * `failed` lifecycle events Meta pushes for every outbound message,
 * regardless of whether it went out via the Marketing Messages API or the Cloud API.
 *
 * Updates the message row and, when the message belongs to a campaign,
 * bumps the matching aggregate counter — the same counters the Overview/
 * Flows UI reads for live campaign metrics.
 */
export function startStatusUpdateWorker(): Worker<StatusUpdateJob> {
  const worker = new Worker<StatusUpdateJob>(
    'status-update',
    async (job: Job<StatusUpdateJob>) => {
      const { waMessageId, status, errors, pricingCategory } = job.data
      const log = logger.child({ queue: 'status-update', jobId: job.id, waMessageId, status })

      // Replies sent from the agent inbox are sent by agent-api, so they're
      // unknown to this service's messages table — forward the receipt first.
      await agentDeskClient.forwardStatus(waMessageId, status)

      const errorCode = errors?.[0]?.code?.toString()
      const message = await messageRepository.updateStatus(
        waMessageId,
        status,
        errorCode,
        errors ? { errors } : undefined,
      )

      if (!message) {
        // Status arrived before our own send-confirmation write landed (a real race now that the Marketing Messages API
        // answers fast): retry a few times with backoff instead of losing the receipt. After that it is a message id
        // we never sent (e.g. another integration on the same number).
        if (job.attemptsMade < 3) throw new Error(`Status for ${waMessageId} arrived before the message was stored — retrying`)
        log.warn('Received status update for unknown wa_message_id — nothing to update')
        await webhookEventRepository.markProcessed(waMessageId, 'unknown_message_id')
        return { skipped: true }
      }

      // Which API really carried a marketing message: Meta prices Marketing Messages API sends as `marketing_lite`.
      // With the default product_policy (CLOUD_API_FALLBACK) an account that is not onboarded is sent through Cloud API instead.
      if (message.category === 'marketing' && pricingCategory) {
        const channel = pricingCategory === 'marketing_lite' ? 'mm_api' : 'cloud_api'
        if (channel !== message.channel) {
          await messageRepository.updateChannel(waMessageId, channel)
          if (channel === 'cloud_api') log.warn('Marketing message went through Cloud API (fallback): the account may not be onboarded to the Marketing Messages API')
        }
      }

      if (message.campaign_id) {
        const counterField = COUNTER_BY_STATUS[status]
        await campaignRepository.incrementCounter(message.campaign_id, counterField)
      }

      await webhookEventRepository.markProcessed(waMessageId)
      log.info('Message status updated')
      return { updated: true }
    },
    { connection: redis, concurrency: 20 },
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'status-update job failed permanently')
  })

  return worker
}
