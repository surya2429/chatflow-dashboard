import { contactRepository } from '../db/repositories/contactRepository.js'
import {
  conversationRepository, messageRepository, toMessageDto, type Channel,
} from '../db/repositories/conversationRepository.js'
import { recordEvent } from '../realtime/events.js'
import { appendMessage, inTx, push, reload } from './inboxService.js'
import { withTransaction } from '../db/pool.js'
import { botRepository } from '../db/repositories/botRepository.js'

/**
 * Customer-side writes: what arrives from WhatsApp/Instagram webhooks (via
 * the backend/ pipeline calling /internal/*), and what a Website Chat visitor
 * types. Also the bot's own replies, so the agent sees the full exchange.
 */

export interface InboundInput {
  channel: Channel
  phone?: string
  handle?: string
  visitorId?: string
  name: string
  /** Provider user id used to reply (wa_id, IGSID). */
  externalUserId?: string
  /** Provider message id — the dedupe key for webhook redelivery. */
  externalMessageId?: string
  source?: string
  /** Instagram comment/story: the object being responded to. */
  externalRef?: string
  isFollower?: boolean
  visitorMeta?: Record<string, unknown>
  /** Which bot received it. Defaults to the channel's first bot. */
  botId?: string
  text?: string
  /** Website Chat bot-flow captured answer, instead of free text. */
  answer?: { questionType: string; label: string; value: string }
}

const DEFAULT_SOURCE: Record<Channel, string> = { whatsapp: 'direct', instagram: 'dm', webchat: 'direct' }

export function ingestInbound(input: InboundInput) {
  return inTx(async (tx, effects) => {
    if (input.externalMessageId) {
      const dup = await messageRepository.findByExternalId(input.externalMessageId, tx)
      if (dup) return { conversationId: dup.conversation_id, messageId: dup.id, duplicate: true }
    }
    const contact = await contactRepository.upsert({
      channel: input.channel, phone: input.phone, handle: input.handle, visitorId: input.visitorId,
      name: input.name, externalId: input.externalUserId, isFollower: input.isFollower, visitorMeta: input.visitorMeta,
    }, tx)

    // Only Instagram comments thread per commented-on object; DMs and story
    // replies from one person are a single running thread.
    const threadRef = input.channel === 'instagram' && input.source === 'comment' ? input.externalRef ?? null : null
    let conv = await conversationRepository.findOpenForContact(contact.id, threadRef, tx)
    if (!conv) {
      const id = await conversationRepository.create({
        contactId: contact.id, channel: input.channel, source: input.source ?? DEFAULT_SOURCE[input.channel],
        externalRef: input.externalRef ?? null,
        botId: input.botId ?? (await botRepository.defaultForChannel(input.channel, tx)),
      }, tx)
      conv = await reload(tx, id)
    } else {
      await tx.query(`SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE`, [conv.id])
      conv = await reload(tx, conv.id)
    }

    // Website Chat visitors are anonymous until they tell the bot who they
    // are. A captured email or name becomes their identity in the inbox.
    if (input.answer && input.channel === 'webchat') {
      const { questionType, label, value } = input.answer
      if (questionType === 'email' && value.includes('@')) {
        await tx.query(`UPDATE contacts SET profile = profile || jsonb_build_object('email', $2::text) WHERE id = $1`, [contact.id, value.trim()])
      } else if (questionType === 'phone') {
        await tx.query(`UPDATE contacts SET profile = profile || jsonb_build_object('phone', $2::text) WHERE id = $1`, [contact.id, value.trim()])
      } else if (/name/i.test(label) && value.trim()) {
        await tx.query(`UPDATE contacts SET name = $2 WHERE id = $1 AND name LIKE 'Visitor #%'`, [contact.id, value.trim().slice(0, 256)])
      }
      conv = await reload(tx, conv.id)
    }

    const { message, conversation } = await appendMessage(tx, conv, input.answer
      ? { conversationId: conv.id, type: 'answer', text: '', questionType: input.answer.questionType, label: input.answer.label, value: input.answer.value, externalId: input.externalMessageId ?? null }
      : { conversationId: conv.id, type: 'incoming', text: input.text ?? '', sender: contact.name, externalId: input.externalMessageId ?? null },
    { incoming: true })

    // Only the assigned agent is pushed for a customer message. A bot-handled
    // chat is the bot's to answer; escalation (routingService.requestHuman)
    // is what brings a human in.
    if (conversation.status === 'agent' && conversation.agent_id) {
      effects.push(push([conversation.agent_id], {
        kind: 'message', conversationId: conversation.id, channel: conversation.channel,
        title: contact.name, body: (input.answer ? `${input.answer.label}: ${input.answer.value}` : input.text ?? '').slice(0, 180),
      }))
    }
    return { conversationId: conversation.id, messageId: message.id, duplicate: false }
  })
}

/** The bot's reply, recorded so the thread shows what the customer was told. */
export function recordBotMessage(conversationId: string, text: string) {
  return inTx(async (tx) => {
    await tx.query(`SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE`, [conversationId])
    const conv = await reload(tx, conversationId)
    const { message } = await appendMessage(tx, conv, { conversationId, type: 'outgoing', text, sender: 'Bot', delivery: 'sent' })
    return toMessageDto(message)
  })
}

/** Provider delivery receipts (sent → delivered → read, or failed). Never moves backwards. */
export async function applyDeliveryStatus(externalId: string, status: 'sent' | 'delivered' | 'read' | 'failed') {
  const order = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 } as const
  return withTransaction(async (tx) => {
    const msg = await messageRepository.findByExternalId(externalId, tx)
    if (!msg) return false
    if (msg.delivery && status !== 'failed' && order[msg.delivery] >= order[status]) return true
    const updated = await messageRepository.setDelivery(msg.id, status, null, tx)
    const bot = await tx.query<{ bot_id: string | null }>(`SELECT bot_id FROM conversations WHERE id = $1`, [msg.conversation_id])
    if (updated) await recordEvent(tx, { kind: 'message.updated', conversationId: msg.conversation_id, botId: bot.rows[0]?.bot_id ?? null, message: toMessageDto(updated) })
    return true
  })
}

