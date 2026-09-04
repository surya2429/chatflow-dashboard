import type { MessageCategory, TemplatePayload } from '../whatsapp/types.js'

export interface MarketingSendJob {
  campaignId: string
  contactId: string
  waId: string
  phoneNumberId: string
  template: TemplatePayload
}

export interface PrioritySendJob {
  contactId: string
  waId: string
  phoneNumberId: string
  category: MessageCategory
  campaignId?: string | undefined
  conversationId?: string | undefined
  contextMessageId?: string | undefined
  payload:
    | { kind: 'template'; template: TemplatePayload }
    | { kind: 'text'; body: string; previewUrl?: boolean }
}

/** Raw shape of one entry from `entry[].changes[].value.statuses[]`. */
export interface StatusUpdateJob {
  waMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipientId: string
  bizOpaqueCallbackData?: string | undefined
  errors?: Array<{ code: number; title: string; message?: string }> | undefined
  phoneNumberId: string
}

/** Raw shape of one entry from `entry[].changes[].value.messages[]`, plus the sibling `contacts[]` profile. */
export interface InboundMessageJob {
  waMessageId: string
  from: string // wa_id
  timestamp: string
  type: string // text | button | interactive | image | ...
  phoneNumberId: string
  profileName?: string | undefined
  contextMessageId?: string | undefined
  text?: string | undefined
  buttonPayload?: string | undefined
  interactive?: Record<string, unknown> | undefined
  raw: Record<string, unknown>
}
