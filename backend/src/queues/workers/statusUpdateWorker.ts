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
 * regardless of whether it went out via MM Lite or the Cloud API.
 *
 * Updates the message row and, when the message belongs to a campaign,
 * bumps the matching aggregate counter — the same counters the Overview/
 * Flows UI reads for live campaign metrics.
 */
export function startStatusUpdateWorker(): Worker<StatusUpdateJob> {
  const worker = new Worker<StatusUpdateJob>(
    'status-update',
    async (job: Job<StatusUpdateJob>) => {
      const { waMessageId, status, errors } = job.data
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
        // Status arrived before our own send-confirmation write landed (rare race under load),
        // or for a message id we never sent (e.g. another integration on the same number).
        log.warn('Received status update for unknown wa_message_id — nothing to update')
        await webhookEventRepository.markProcessed(waMessageId, 'unknown_message_id')
        return { skipped: true }
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
