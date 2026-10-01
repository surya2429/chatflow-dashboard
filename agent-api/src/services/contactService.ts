import { authorize, type Actor } from '../auth/policy.js'
import { notFound, badRequest, forbidden } from '../http/errors.js'
import { withTransaction } from '../db/pool.js'
import { contactRepository, toContactDto, toE164 } from '../db/repositories/contactRepository.js'
import {
  conversationRepository, messageRepository, toConversationDto, toMessageDto,
} from '../db/repositories/conversationRepository.js'
import { recordEvent } from '../realtime/events.js'
import { visibleBotIds } from '../db/repositories/botRepository.js'
import type { PoolClient } from 'pg'
import type { Channel } from '../db/repositories/conversationRepository.js'
import { inTx, reload, sendReply, sendTemplate } from './inboxService.js'

/**
 * The contact side panel, and starting conversations.
 */
export async function getContactPanel(actor: Actor, contactId: string) {
  authorize(actor, 'conversation.read')
  const contact = await contactRepository.findById(contactId)
  if (!contact) throw notFound('contact_not_found')
  const [answers, all, scope] = await Promise.all([
    messageRepository.answersForContact(contactId),
    conversationRepository.listForContact(contactId),
    visibleBotIds(actor),
  ])
  // A contact is visible through the conversations the actor can see.
  const conversations = scope ? all.filter(c => !c.bot_id || scope.includes(c.bot_id)) : all
  if (all.length && !conversations.length) throw forbidden('not_your_bot', "This contact only talks to bots you're not assigned to")
  return {
    contact: toContactDto(contact),
    // Everything the bot flow captured from this person, across all their
    // conversations — the dashboard's "captured answers" rollup.
    capturedAnswers: answers.map(toMessageDto),
    conversations: conversations.map(c => ({
      id: c.id, status: c.status, lastMessage: c.last_message, timestamp: c.last_message_at.toISOString(),
      agentName: c.agent_name, source: c.source, botName: c.bot_name,
    })),
  }
}

export async function updateContact(actor: Actor, contactId: string, patch: { name?: string; profile?: Record<string, unknown>; customFields?: Record<string, unknown> }) {
  authorize(actor, 'contact.update')
  await getContactPanel(actor, contactId) // same visibility rule as reading it
  const updated = await contactRepository.update(contactId, patch)
  if (!updated) throw notFound('contact_not_found')
  // The name shows in every conversation row, so their list entries must refresh.
  if (patch.name) {
    await withTransaction(async (tx) => {
      const convs = await tx.query<{ id: string }>(`UPDATE conversations SET version = version WHERE contact_id = $1 RETURNING id`, [contactId])
      for (const { id } of convs.rows) {
        await recordEvent(tx, { kind: 'conversation.updated', conversation: toConversationDto(await reload(tx, id)) })
      }
    })
  }
  return toContactDto(updated)
}

/**
 * The bot a new outbound conversation goes out from: the one asked for (which
 * must be of the right channel and visible to the actor), or the actor's
 * first bot on that channel.
 */
async function botForStart(actor: Actor, channel: Channel, botId: string | undefined, tx: PoolClient): Promise<string> {
  const scope = await visibleBotIds(actor, tx)
  const rows = await tx.query<{ id: string }>(
    `SELECT id FROM bots WHERE channel = $1 AND status = 'active'
       AND ($2::uuid IS NULL OR id = $2) AND ($3::uuid[] IS NULL OR id = ANY($3::uuid[]))
     ORDER BY created_at LIMIT 1`,
    [channel, botId ?? null, scope])
  const id = rows.rows[0]?.id
  if (!id) throw forbidden('no_bot_for_channel', `You're not assigned to an active ${channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'} bot`)
  return id
}

/**
 * WhatsApp: a business may only open a conversation with an approved
 * template. The contact is created if new; an existing open thread is reused
 * rather than forked.
 */
export async function startWhatsApp(actor: Actor, input: { phone: string; name: string; templateId: string; variables: string[]; clientMsgId?: string; botId?: string }) {
  authorize(actor, 'conversation.start')
  const phone = normalizePhone(input.phone)
  const conversationId = await withTransaction(async (tx) => {
    const contact = await contactRepository.upsert({ channel: 'whatsapp', phone, name: input.name, externalId: phone.replace(/\D/g, '') }, tx)
    const open = await conversationRepository.findOpenForContact(contact.id, null, tx)
    if (open) return open.id
    const botId = await botForStart(actor, 'whatsapp', input.botId, tx)
    const id = await conversationRepository.create({ contactId: contact.id, channel: 'whatsapp', source: 'direct', status: 'agent', agentId: actor.id, botId }, tx)
    await recordEvent(tx, { kind: 'conversation.updated', conversation: toConversationDto(await reload(tx, id)) })
    return id
  })
  const message = await sendTemplate(actor, conversationId, { templateId: input.templateId, variables: input.variables, clientMsgId: input.clientMsgId })
  return { conversationId, message }
}

/** Instagram: new conversations can only be started with an existing follower. */
export async function startInstagram(actor: Actor, input: { contactId: string; text: string; clientMsgId?: string; botId?: string }) {
  authorize(actor, 'conversation.start')
  const conversationId = await inTx(async (tx) => {
    const contact = await contactRepository.findById(input.contactId, tx)
    if (!contact || contact.channel !== 'instagram') throw notFound('contact_not_found')
    if (!contact.is_follower) throw forbidden('not_a_follower', 'Instagram only allows starting conversations with followers')
    const open = await conversationRepository.findOpenForContact(contact.id, null, tx)
    if (open) throw badRequest('conversation_already_open', 'This person already has an open conversation', { conversationId: open.id })
    const botId = await botForStart(actor, 'instagram', input.botId, tx)
    const id = await conversationRepository.create({ contactId: contact.id, channel: 'instagram', source: 'dm', status: 'agent', agentId: actor.id, botId }, tx)
    await recordEvent(tx, { kind: 'conversation.updated', conversation: toConversationDto(await reload(tx, id)) })
    return id
  })
  const message = await sendReply(actor, conversationId, { text: input.text, clientMsgId: input.clientMsgId })
  return { conversationId, message }
}

export async function listInstagramFollowers(actor: Actor, q: string | undefined) {
  authorize(actor, 'conversation.start')
  return (await contactRepository.instagramFollowersWithoutOpenThread(q, 50)).map(toContactDto)
}

function normalizePhone(raw: string): string {
  const phone = toE164(raw)
  if (!phone) throw badRequest('invalid_phone', 'Enter the number in international format, e.g. +91 98765 43210')
  return phone
}
