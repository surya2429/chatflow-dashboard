import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { verifyWebhookSignature } from './signature.js'
import { WebhookPayloadSchema, type WebhookMessage, type WebhookStatus } from './webhookTypes.js'
import { claimEventOnce } from '../services/dedupeService.js'
import { statusUpdateQueue, inboundMessageQueue } from '../queues/queues.js'
import { webhookEventRepository } from '../db/repositories/webhookEventRepository.js'
import type { StatusUpdateJob, InboundMessageJob } from '../queues/jobTypes.js'

/**
 * GET /webhook — Meta's one-time subscription handshake. Echo back
 * `hub.challenge` iff `hub.verify_token` matches what we configured in the
 * Meta Dashboard; otherwise 403. Meta calls this once per subscription
 * setup / whenever you change the callback URL — not per event.
 */
export function handleVerify(req: Request, res: Response): void {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === env.WA_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook verification succeeded')
    res.status(200).send(String(challenge))
    return
  }

  logger.warn({ mode }, 'Webhook verification failed — token mismatch or wrong mode')
  res.sendStatus(403)
}

/**
 * POST /webhook — the actual event delivery endpoint.
 *
 * Ordering matters here:
 *   1. Signature check (cheap, synchronous, no I/O) — reject forgeries
 *      before we do anything else.
 *   2. Respond 200 immediately. Meta treats anything other than a fast 2xx
 *      as a delivery failure and will retry with backoff, which — at
 *      scale — turns a slow downstream into a webhook storm.
 *   3. *After* responding, dedupe + enqueue. Errors here are logged, not
 *      surfaced to Meta — the response already went out, and BullMQ's own
 *      retry policy is what protects job processing, not webhook retries.
 */
export function handleReceive(req: Request, res: Response): void {
  const rawBody = req.rawBody
  const signature = req.header('X-Hub-Signature-256')

  if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Webhook signature verification failed — rejecting')
    res.sendStatus(401)
    return
  }

  // Ack immediately — everything after this line runs after the response is already sent.
  res.status(200).send('EVENT_RECEIVED')

  void processPayload(req.body).catch((err: unknown) => {
    logger.error({ err }, 'Unhandled error while processing webhook payload (already ack\'d to Meta)')
  })
}

async function processPayload(body: unknown): Promise<void> {
  const parsed = WebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'Webhook payload failed schema validation — skipping')
    return
  }

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue // ignore other subscribed fields (e.g. account_alerts) at this layer
      const { value } = change
      const phoneNumberId = value.metadata.phone_number_id
      const profileByWaId = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]))

      for (const status of value.statuses ?? []) {
        await enqueueStatusUpdate(status, phoneNumberId)
      }

      for (const message of value.messages ?? []) {
        await enqueueInboundMessage(message, phoneNumberId, profileByWaId.get(message.from))
      }
    }
  }
}

async function enqueueStatusUpdate(status: WebhookStatus, phoneNumberId: string): Promise<void> {
  const claimed = await claimEventOnce(`status:${status.id}:${status.status}`)
  if (!claimed) {
    logger.debug({ waMessageId: status.id, status: status.status }, 'Duplicate status webhook — already processed')
    return
  }

  void webhookEventRepository.log('status', status.id, status).catch((err: unknown) => {
    logger.error({ err }, 'Failed to write webhook_events audit row (non-fatal)')
  })

  const job: StatusUpdateJob = {
    waMessageId: status.id,
    status: status.status,
    timestamp: status.timestamp,
    recipientId: status.recipient_id,
    bizOpaqueCallbackData: status.biz_opaque_callback_data,
    errors: status.errors,
    phoneNumberId,
  }
  await statusUpdateQueue.add('status-update', job, { jobId: `status:${status.id}:${status.status}` })
}

async function enqueueInboundMessage(
  message: WebhookMessage,
  phoneNumberId: string,
  profileName: string | undefined,
): Promise<void> {
  const claimed = await claimEventOnce(`message:${message.id}`)
  if (!claimed) {
    logger.debug({ waMessageId: message.id }, 'Duplicate inbound message webhook — already processed')
    return
  }

  void webhookEventRepository.log('inbound_message', message.id, message).catch((err: unknown) => {
    logger.error({ err }, 'Failed to write webhook_events audit row (non-fatal)')
  })

  const job: InboundMessageJob = {
    waMessageId: message.id,
    from: message.from,
    timestamp: message.timestamp,
    type: message.type,
    phoneNumberId,
    profileName,
    contextMessageId: message.context?.id,
    text: message.text?.body,
    buttonPayload: message.button?.payload,
    interactive: message.interactive,
    raw: message as unknown as Record<string, unknown>,
  }
  await inboundMessageQueue.add('inbound-message', job, { jobId: `message:${message.id}` })
}
