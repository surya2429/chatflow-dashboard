import { query } from '../pool.js'
import { logger } from '../../config/logger.js'
import { countWhatsAppMessage } from '../../billing/usageSql.js'

export type MessageDirection = 'inbound' | 'outbound'
export type MessageChannel = 'mm_lite' | 'cloud_api'
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'deleted'
export type MessageCategory = 'marketing' | 'utility' | 'authentication' | 'service'

export interface Message {
  id: string
  wa_message_id: string | null
  direction: MessageDirection
  channel: MessageChannel
  category: MessageCategory
  contact_id: string
  campaign_id: string | null
  conversation_id: string | null
  phone_number_id: string
  status: MessageStatus
  message_type: string
  template_name: string | null
  payload: Record<string, unknown>
  biz_opaque_callback_data: string | null
  context_message_id: string | null
}

export interface CreateOutboundMessageInput {
  waMessageId: string
  channel: MessageChannel
  category: MessageCategory
  contactId: string
  campaignId?: string | undefined
  conversationId?: string | undefined
  phoneNumberId: string
  messageType: string
  templateName?: string | undefined
  payload: Record<string, unknown>
  bizOpaqueCallbackData: string
}

export interface CreateInboundMessageInput {
  waMessageId: string
  contactId: string
  conversationId: string | null
  phoneNumberId: string
  messageType: string
  payload: Record<string, unknown>
  contextMessageId?: string | undefined
}

export const messageRepository = {
  async createOutbound(input: CreateOutboundMessageInput): Promise<Message> {
    const rows = await query<Message>(
      `INSERT INTO messages
         (wa_message_id, direction, channel, category, contact_id, campaign_id, conversation_id,
          phone_number_id, status, message_type, template_name, payload, biz_opaque_callback_data)
       VALUES ($1, 'outbound', $2, $3, $4, $5, $6, $7, 'sent', $8, $9, $10, $11)
       RETURNING *`,
      [
        input.waMessageId, input.channel, input.category, input.contactId, input.campaignId ?? null,
        input.conversationId ?? null, input.phoneNumberId, input.messageType, input.templateName ?? null,
        JSON.stringify(input.payload), input.bizOpaqueCallbackData,
      ],
    )
    const message = rows[0]
    if (!message) throw new Error('Failed to insert outbound message')
    // Usage for the client's plan allowance. Never let counting get in the way of sending.
    countWhatsAppMessage(input.phoneNumberId, input.category).catch((err: unknown) => logger.warn({ err }, 'could not count WhatsApp usage'))
    return message
  },

  async createInbound(input: CreateInboundMessageInput): Promise<Message> {
    const rows = await query<Message>(
      `INSERT INTO messages
         (wa_message_id, direction, channel, category, contact_id, conversation_id,
          phone_number_id, status, message_type, payload, context_message_id)
       VALUES ($1, 'inbound', 'cloud_api', 'service', $2, $3, $4, 'delivered', $5, $6, $7)
       ON CONFLICT (wa_message_id) DO NOTHING
       RETURNING *`,
      [
        input.waMessageId, input.contactId, input.conversationId, input.phoneNumberId,
        input.messageType, JSON.stringify(input.payload), input.contextMessageId ?? null,
      ],
    )
    // ON CONFLICT DO NOTHING returns no row on a duplicate — caller (InboundMessageWorker)
    // must treat a null return as "already processed", not an error.
    return rows[0] as Message
  },

  async findByWaMessageId(waMessageId: string): Promise<Message | null> {
    const rows = await query<Message>('SELECT * FROM messages WHERE wa_message_id = $1', [waMessageId])
    return rows[0] ?? null
  },

  async updateStatus(
    waMessageId: string,
    status: MessageStatus,
    errorCode?: string,
    errorDetail?: Record<string, unknown>,
  ): Promise<Message | null> {
    const TIMESTAMP_COL_BY_STATUS: Partial<Record<MessageStatus, string>> = {
      sent: 'sent_at', delivered: 'delivered_at', read: 'read_at', failed: 'failed_at',
    }
    const timestampCol = TIMESTAMP_COL_BY_STATUS[status]
    const rows = await query<Message>(
      `UPDATE messages
       SET status = $2
           ${timestampCol ? `, ${timestampCol} = now()` : ''}
           ${errorCode ? ', error_code = $3, error_detail = $4' : ''}
       WHERE wa_message_id = $1
       RETURNING *`,
      errorCode ? [waMessageId, status, errorCode, JSON.stringify(errorDetail ?? {})] : [waMessageId, status],
    )
    return rows[0] ?? null
  },
}
