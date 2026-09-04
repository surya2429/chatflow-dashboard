import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { WhatsAppApiError, type SendResult } from './types.js'

const GRAPH_BASE = `https://graph.facebook.com/${env.WA_GRAPH_API_VERSION}`

/**
 * Shared HTTP plumbing for both the Cloud API and MM Lite clients — auth
 * header, JSON handling, and translating Meta's error envelope into a
 * typed `WhatsAppApiError` so callers (queue workers) can branch on
 * `isRateLimited` / `isOutsideServiceWindow` without parsing raw bodies.
 *
 * Deliberately NOT retrying here — retry policy belongs to the caller
 * (BullMQ job options), since marketing vs priority sends want different
 * backoff strategies.
 */
export abstract class BaseWhatsAppClient {
  protected readonly phoneNumberId: string
  protected readonly accessToken: string

  constructor(phoneNumberId: string = env.WA_PHONE_NUMBER_ID, accessToken: string = env.WA_ACCESS_TOKEN) {
    this.phoneNumberId = phoneNumberId
    this.accessToken = accessToken
  }

  protected async post(path: string, body: unknown): Promise<SendResult> {
    const url = `${GRAPH_BASE}/${this.phoneNumberId}/${path}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const json = (await res.json().catch(() => null)) as
      | { messages?: Array<{ id: string }>; error?: { message: string; code: number; error_subcode?: number } }
      | null

    if (!res.ok || !json) {
      const err = json?.error
      logger.error({ status: res.status, url, error: err }, 'WhatsApp API request failed')
      throw new WhatsAppApiError(
        err?.message ?? `WhatsApp API request failed with status ${res.status}`,
        res.status,
        err?.code,
        err?.error_subcode,
        json,
      )
    }

    const waMessageId = json.messages?.[0]?.id
    if (!waMessageId) {
      throw new WhatsAppApiError('WhatsApp API returned 2xx but no message id', res.status, undefined, undefined, json)
    }

    return { waMessageId, rawResponse: json }
  }

  /** For calls that don't return a `messages[]` id, e.g. marking a message read. */
  protected async postVoid(path: string, body: unknown): Promise<void> {
    const url = `${GRAPH_BASE}/${this.phoneNumberId}/${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null) as { error?: { message: string; code: number } } | null
      logger.error({ status: res.status, url, error: json?.error }, 'WhatsApp API request failed')
      throw new WhatsAppApiError(
        json?.error?.message ?? `WhatsApp API request failed with status ${res.status}`,
        res.status,
        json?.error?.code,
        undefined,
        json,
      )
    }
  }
}
