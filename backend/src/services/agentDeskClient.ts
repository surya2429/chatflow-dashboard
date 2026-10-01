import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

/**
 * Forwards WhatsApp traffic to the live-agent service (agent-api/), which owns
 * conversations, the agent inbox and the mobile app. This service keeps doing
 * what it's good at — signature checks, dedupe, queues, attribution — and
 * hands agent-api a normalized event.
 *
 * Optional: with AGENT_API_URL unset (the default), nothing is forwarded and
 * this backend behaves exactly as before.
 *
 * Retries happen here rather than by failing the BullMQ job: by the time this
 * runs, the inbound message is already recorded, and a retried job takes the
 * duplicate-delivery early exit — so a thrown error would lose the forward
 * for good. agent-api dedupes on the wa_message_id, so a retry that did land
 * the first time is harmless.
 */
const enabled = Boolean(env.AGENT_API_URL && env.AGENT_API_INTERNAL_KEY)

async function post(path: string, body: unknown): Promise<void> {
  if (!enabled) return
  const url = `${env.AGENT_API_URL!.replace(/\/$/, '')}${path}`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': env.AGENT_API_INTERNAL_KEY! },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      })
      // 4xx won't get better on retry (validation, auth) — log and stop.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        if (!res.ok) logger.error({ path, status: res.status, body: await res.text() }, '[agent-desk] rejected')
        return
      }
    } catch (err) {
      if (attempt === 4) logger.error({ err, path }, '[agent-desk] forward failed after retries')
    }
    await new Promise(r => setTimeout(r, 250 * 2 ** attempt))
  }
}

export const agentDeskClient = {
  enabled,

  forwardInbound(m: {
    waId: string
    profileName?: string | undefined
    waMessageId: string
    messageType: string
    text?: string | undefined
    fromCampaign: boolean
  }): Promise<void> {
    return post('/internal/inbound', {
      channel: 'whatsapp',
      phone: m.waId,
      name: m.profileName || `+${m.waId}`,
      externalUserId: m.waId,
      externalMessageId: m.waMessageId,
      source: m.fromCampaign ? 'broadcast' : 'direct',
      // Media and interactive types show as a placeholder until the inbox
      // renders them natively.
      text: m.text ?? `[${m.messageType}]`,
    })
  },

  forwardStatus(waMessageId: string, status: string): Promise<void> {
    if (!['sent', 'delivered', 'read', 'failed'].includes(status)) return Promise.resolve()
    return post('/internal/delivery', { externalId: waMessageId, status })
  },
}
