/** Shared request/response contracts for both the Cloud API and MM Lite clients. */

export type MessageCategory = 'marketing' | 'utility' | 'authentication' | 'service'

export interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  sub_type?: 'quick_reply' | 'url' | 'catalog'
  index?: string
  parameters?: Array<{ type: 'text' | 'currency' | 'date_time' | 'image' | 'payload'; text?: string; payload?: string }>
}

export interface TemplatePayload {
  name: string
  language: { code: string }
  components?: TemplateComponent[]
}

/**
 * `biz_opaque_callback_data` is Meta's pass-through tracking field — Meta
 * stores it verbatim and echoes it back on every status webhook for that
 * message. We encode our own internal message UUID + campaign id into it
 * (base64 JSON) so status webhooks can be correlated back to our DB without
 * a second round trip, even before the synchronous send response returns.
 */
export interface CallbackToken {
  messageId: string
  campaignId?: string
}

export interface SendTemplateRequest {
  to: string // wa_id, digits only, no '+'
  template: TemplatePayload
  category: MessageCategory
  callback: CallbackToken
}

export interface SendTextRequest {
  to: string
  body: string
  previewUrl?: boolean
  /** Set when replying inside an open service window, to thread the reply visually. */
  contextMessageId?: string
  callback: CallbackToken
}

export interface SendResult {
  waMessageId: string
  rawResponse: unknown
}

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly metaErrorCode?: number,
    public readonly metaErrorSubcode?: number,
    public readonly rawBody?: unknown,
  ) {
    super(message)
    this.name = 'WhatsAppApiError'
  }

  /** Meta error 131056 / 131048 etc. — pacing/throughput limit hit; caller should back off and retry. */
  get isRateLimited(): boolean {
    return this.statusCode === 429 || this.metaErrorCode === 131_056 || this.metaErrorCode === 80_007
  }

  /** Recipient has no active session / is outside the 24h window for freeform sends. */
  get isOutsideServiceWindow(): boolean {
    return this.metaErrorCode === 131_047
  }
}

export function encodeCallbackToken(token: CallbackToken): string {
  return Buffer.from(JSON.stringify(token), 'utf8').toString('base64url')
}

export function decodeCallbackToken(raw: string | undefined | null): CallbackToken | null {
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as CallbackToken
  } catch {
    return null
  }
}
