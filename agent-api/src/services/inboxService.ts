import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { withTransaction } from '../db/pool.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { authorize, authorizeOnConversation, type Actor, type Capability } from '../auth/policy.js'
import { badRequest, conflict, HttpError, notFound } from '../http/errors.js'
import {
  conversationRepository, messageRepository, toConversationDto, toMessageDto, whatsappWindow,
  type ConversationRow, type MessageRow, type MessageType,
} from '../db/repositories/conversationRepository.js'
import { userRepository } from '../db/repositories/userRepository.js'
import { assertBotVisible, botRepository } from '../db/repositories/botRepository.js'
import { renderTemplateBody, templateRepository } from '../db/repositories/templateRepository.js'
import { recordEvent } from '../realtime/events.js'
import { deliverOutbound, type IgReplyMode, type OutboundContent } from '../channels/outbound.js'
import { notifyUsersLater } from '../push/notificationService.js'
import { attachmentRepository, snapshotOf, type AttachmentRow, type AttachmentSnapshot } from '../db/repositories/attachmentRepository.js'
import { cleanFileName, contentMatches, imageSize, ruleFor } from './attachmentPolicy.js'
import { fileStore } from '../storage/fileStore.js'
import { signedFilePath } from '../storage/signedUrl.js'
import type { PushPayload } from '../push/types.js'

/**
 * Every agent action on a conversation, as one place that enforces the rules.
 *
 * Each mutation is one transaction that: locks the conversation row, checks
 * authorization against its CURRENT state (not what the client last saw),
 * applies the change, writes any thread event ("Assigned to …"), and records
 * the live event. Pushes and outbound channel sends run only after commit.
 */

type Effect = () => void
interface TxResult<T> { value: T; effects: Effect[] }

async function inTx<T>(fn: (tx: PoolClient, effects: Effect[]) => Promise<T>): Promise<T> {
  const { value, effects } = await withTransaction<TxResult<T>>(async (tx) => {
    const effects: Effect[] = []
    const value = await fn(tx, effects)
    return { value, effects }
  })
  for (const run of effects) {
    try { run() } catch (err) { logger.error({ err }, '[inbox] post-commit effect failed') }
  }
  return value
}

async function load(tx: PoolClient, id: string): Promise<ConversationRow> {
  const conv = await conversationRepository.findById(id, tx, { lock: true })
  if (!conv) throw notFound('conversation_not_found')
  return conv
}

/** load() for an actor: also refuses conversations of bots they aren't assigned to. */
async function loadFor(actor: Actor, tx: PoolClient, id: string): Promise<ConversationRow> {
  const conv = await load(tx, id)
  await assertBotVisible(actor, conv.bot_id, tx)
  return conv
}

async function reload(tx: PoolClient, id: string): Promise<ConversationRow> {
  return (await conversationRepository.findById(id, tx))!
}

/** Types that are part of the customer-visible exchange and so move the list preview. */
const PREVIEW_TYPES: MessageType[] = ['incoming', 'outgoing', 'template', 'answer']

const ATTACHMENT_LABEL = { image: '📷 Photo', video: '🎬 Video', audio: '🎵 Audio', document: '📄 Document' } as const

function previewText(m: {
  type: MessageType; text: string; label?: string | null; value?: string | null; event?: string | null; attachment?: AttachmentSnapshot | null
}): string {
  if (m.type === 'answer') return `${m.label ?? 'Answer'}: ${m.value ?? ''}`
  if (m.attachment) {
    const label = m.attachment.kind === 'document' ? `📄 ${m.attachment.name}` : ATTACHMENT_LABEL[m.attachment.kind]
    return m.text ? `${label.split(' ')[0]} ${m.text}` : label
  }
  return m.text
}

/**
 * Appends a message and emits one `message.created` carrying the updated
 * conversation, so a client applies both from a single event.
 */
async function appendMessage(
  tx: PoolClient,
  conv: ConversationRow,
  msg: Parameters<typeof messageRepository.insert>[0],
  opts: { incoming?: boolean; movesPreview?: boolean } = {},
): Promise<{ message: MessageRow; conversation: ConversationRow }> {
  const message = await messageRepository.insert(msg, tx)
  const movesPreview = opts.movesPreview ?? PREVIEW_TYPES.includes(msg.type)
  if (movesPreview || opts.incoming) {
    const set: Record<string, unknown> = {}
    if (movesPreview) {
      set.last_message = previewText(message).slice(0, 500)
      set.last_message_at = message.created_at
    }
    if (opts.incoming) {
      set.unread = conv.unread + 1
      set.last_inbound_at = message.created_at
      // A customer writing again brings the chat back into view.
      set.archived = false
      set.snoozed_until = null
    }
    await conversationRepository.update(conv.id, set, tx)
  } else {
    // Still bump the version so clients know the thread changed.
    await tx.query(`UPDATE conversations SET version = version WHERE id = $1`, [conv.id])
  }
  const updated = await reload(tx, conv.id)
  await recordEvent(tx, { kind: 'message.created', conversation: toConversationDto(updated), message: toMessageDto(message) })
  return { message, conversation: updated }
}

async function emitUpdated(tx: PoolClient, id: string): Promise<ConversationRow> {
  const updated = await reload(tx, id)
  await recordEvent(tx, { kind: 'conversation.updated', conversation: toConversationDto(updated) })
  return updated
}

function eventMessage(conv: ConversationRow, event: string, text: string) {
  return { conversationId: conv.id, type: 'event' as const, text, event }
}

function push(userIds: (string | null | undefined)[], payload: PushPayload): Effect {
  return () => notifyUsersLater(userIds.filter((x): x is string => !!x), payload)
}

/** Sends to the channel after commit and records the delivery outcome as its own event. */
function deliverLater(conv: ConversationRow, message: MessageRow, content: OutboundContent): Effect {
  return () => {
    void (async () => {
      let delivery: MessageRow['delivery'] = 'sent'
      let externalId: string | null = null
      try {
        externalId = (await deliverOutbound(conv, content)).externalId
      } catch (err) {
        delivery = 'failed'
        logger.warn({ err, conversationId: conv.id }, '[inbox] outbound send failed')
      }
      await withTransaction(async (tx) => {
        const updated = await messageRepository.setDelivery(message.id, delivery, externalId, tx)
        if (updated) await recordEvent(tx, { kind: 'message.updated', conversationId: conv.id, botId: conv.bot_id, message: toMessageDto(updated) })
      })
    })().catch((err) => logger.error({ err }, '[inbox] delivery bookkeeping failed'))
  }
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getConversation(actor: Actor, id: string) {
  authorize(actor, 'conversation.read')
  const conv = await conversationRepository.findById(id)
  if (!conv) throw notFound('conversation_not_found')
  await assertBotVisible(actor, conv.bot_id)
  return toConversationDto(conv)
}

export async function getMessages(actor: Actor, id: string, before: string | null, limit: number) {
  authorize(actor, 'conversation.read')
  const conv = await conversationRepository.findById(id)
  if (!conv) throw notFound('conversation_not_found')
  await assertBotVisible(actor, conv.bot_id)
  const page = await messageRepository.page(id, before, limit)
  return { items: page.items.map(toMessageDto), hasMore: page.hasMore }
}

// ── Simple flag changes ─────────────────────────────────────────────────────

async function patch(actor: Actor, id: string, capability: Capability, ownership: boolean,
  build: (conv: ConversationRow) => Record<string, unknown> | null) {
  return inTx(async (tx) => {
    const conv = await loadFor(actor, tx, id)
    if (ownership) authorizeOnConversation(actor, capability, conv)
    else authorize(actor, capability)
    const set = build(conv)
    if (!set) return toConversationDto(conv)
    await conversationRepository.update(id, set, tx)
    return toConversationDto(await emitUpdated(tx, id))
  })
}

export const markRead = (actor: Actor, id: string) =>
  patch(actor, id, 'conversation.read', false, c => (c.unread === 0 ? null : { unread: 0 }))

export const setStarred = (actor: Actor, id: string, starred: boolean) =>
  patch(actor, id, 'conversation.star', false, c => (c.starred === starred ? null : { starred }))

export const setArchived = (actor: Actor, id: string, archived: boolean) =>
  patch(actor, id, 'conversation.archive', true, c => (c.archived === archived ? null : { archived }))

export function snooze(actor: Actor, id: string, until: Date | null) {
  if (until && until.getTime() <= Date.now()) throw badRequest('snooze_in_past')
  return patch(actor, id, 'conversation.snooze', true, () => ({ snoozed_until: until }))
}

export const addLabel = (actor: Actor, id: string, label: string) =>
  patch(actor, id, 'conversation.label', false, c => (c.labels.includes(label) ? null : { labels: [...c.labels, label] }))

export const removeLabel = (actor: Actor, id: string, label: string) =>
  patch(actor, id, 'conversation.label', false, c => (c.labels.includes(label) ? { labels: c.labels.filter(l => l !== label) } : null))

// ── Ownership changes ───────────────────────────────────────────────────────

export function takeOver(actor: Actor, id: string) {
  return inTx(async (tx) => {
    const conv = await loadFor(actor, tx, id)
    authorizeOnConversation(actor, 'conversation.takeover', conv)
    if (conv.status === 'agent' && conv.agent_id === actor.id) return toConversationDto(conv)
    const previousAgent = conv.status === 'agent' ? conv.agent_id : null
    await conversationRepository.update(id, { status: 'agent', agent_id: actor.id, needs_agent_since: null, resolved_at: null }, tx)
    const text = conv.status === 'bot'
      ? `Conversation handed over from Bot to ${actor.name}`
      : previousAgent ? `${actor.name} took over the conversation` : `Assigned to ${actor.name}`
    const { conversation } = await appendMessage(tx, await reload(tx, id), eventMessage(conv, conv.status === 'bot' ? 'bot_handover' : 'assigned', text))
    return toConversationDto(conversation)
  })
}

export function transfer(actor: Actor, id: string, toUserId: string) {
  return inTx(async (tx, effects) => {
    const conv = await loadFor(actor, tx, id)
    authorizeOnConversation(actor, 'conversation.transfer', conv)
    const target = await userRepository.findById(toUserId, tx)
    if (!target || !target.is_active) throw badRequest('invalid_transfer_target')
    if (target.role === 'agent' && conv.bot_id && !(await botRepository.isAssigned(conv.bot_id, target.id, tx))) {
      throw badRequest('target_not_on_bot', `${target.name} isn't assigned to ${conv.bot_name ?? 'this bot'}`)
    }
    if (conv.status === 'agent' && conv.agent_id === target.id) return toConversationDto(conv)
    await conversationRepository.update(id, { status: 'agent', agent_id: target.id, needs_agent_since: null, resolved_at: null }, tx)
    const text = target.id === actor.id ? `Assigned to ${target.name}` : `Transferred to ${target.name} by ${actor.name}`
    const { conversation } = await appendMessage(tx, await reload(tx, id), eventMessage(conv, 'assigned', text))
    if (target.id !== actor.id) {
      effects.push(push([target.id], {
        kind: 'assignment', conversationId: id, channel: conv.channel,
        title: `${actor.name} assigned you a chat`, body: `${conv.name}: ${conv.last_message}`.slice(0, 180),
      }))
    }
    return toConversationDto(conversation)
  })
}

export function resolve(actor: Actor, id: string) {
  return inTx(async (tx) => {
    const conv = await loadFor(actor, tx, id)
    authorizeOnConversation(actor, 'conversation.resolve', conv)
    if (conv.status === 'resolved') return toConversationDto(conv)
    await conversationRepository.update(id, { status: 'resolved', unread: 0, resolved_at: new Date(), needs_agent_since: null }, tx)
    const { conversation } = await appendMessage(tx, await reload(tx, id),
      { ...eventMessage(conv, 'resolved', `Resolved by ${actor.name}`), agentId: actor.id, agentName: actor.name })
    return toConversationDto(conversation)
  })
}

export function returnToBot(actor: Actor, id: string) {
  return inTx(async (tx) => {
    const conv = await loadFor(actor, tx, id)
    authorizeOnConversation(actor, 'conversation.return_to_bot', conv)
    if (conv.status === 'bot' && !conv.agent_id) return toConversationDto(conv)
    await conversationRepository.update(id, { status: 'bot', agent_id: null, needs_agent_since: null }, tx)
    const { conversation } = await appendMessage(tx, await reload(tx, id), eventMessage(conv, 'bot_handover', `Returned to bot by ${actor.name}`))
    return toConversationDto(conversation)
  })
}

// ── Messages ────────────────────────────────────────────────────────────────

export function addNote(actor: Actor, id: string, text: string) {
  return inTx(async (tx) => {
    const conv = await loadFor(actor, tx, id)
    authorize(actor, 'conversation.note')
    // Notes never reach the customer and never move the list preview.
    const { message } = await appendMessage(tx, conv, {
      conversationId: id, type: 'note', text, sender: actor.name, agentId: actor.id, agentName: actor.name,
    }, { movesPreview: false })
    return toMessageDto(message)
  })
}

const IG_PRIVATE_REPLY_WINDOW_MS = 7 * 86_400_000

// ── Attachments ─────────────────────────────────────────────────────────────

const CHANNEL_NAME = { whatsapp: 'WhatsApp', instagram: 'Instagram', webchat: 'Website chat' } as const

export function toAttachmentDto(a: AttachmentRow) {
  return { ...snapshotOf(a), url: signedFilePath(a.id, a.file_name) }
}

/**
 * Stores a file for a reply in this conversation. It is only a draft until a
 * message references it; unsent uploads are swept after a day. The type is
 * checked against what the conversation's channel accepts and against the
 * file's actual bytes, and the same reply rules apply as for text.
 */
export async function uploadAttachment(actor: Actor, id: string, file: { mime: string; name?: string; data: Buffer }) {
  authorize(actor, 'conversation.reply')
  const conv = await conversationRepository.findById(id)
  if (!conv) throw notFound('conversation_not_found')
  await assertBotVisible(actor, conv.bot_id)
  authorizeOnConversation(actor, 'conversation.reply', conv)

  const mime = file.mime.split(';')[0]!.trim().toLowerCase()
  const rule = ruleFor(conv.channel, mime, env.MAX_UPLOAD_MB * 1024 * 1024)
  if (!rule.ok) {
    throw new HttpError(415, 'attachment_type_not_allowed', `This type of file can't be sent on ${CHANNEL_NAME[conv.channel]}`, { allowed: rule.allowed })
  }
  if (file.data.length === 0) throw badRequest('attachment_empty', 'The file is empty')
  if (file.data.length > rule.maxBytes) {
    throw new HttpError(413, 'attachment_too_large',
      `Files like this can be up to ${Math.floor(rule.maxBytes / (1024 * 1024))} MB on ${CHANNEL_NAME[conv.channel]}`, { maxBytes: rule.maxBytes })
  }
  if (!contentMatches(mime, file.data)) throw new HttpError(415, 'attachment_content_mismatch', 'The file doesn’t match its type')

  const size = rule.kind === 'image' ? imageSize(mime, file.data) : null
  const attachmentId = randomUUID()
  await fileStore.put(attachmentId, file.data)
  try {
    const row = await attachmentRepository.insert({
      id: attachmentId, conversationId: id, uploadedBy: actor.id, kind: rule.kind, fileName: cleanFileName(file.name, mime),
      mimeType: mime, sizeBytes: file.data.length, width: size?.width ?? null, height: size?.height ?? null, storageKey: attachmentId,
    })
    return toAttachmentDto(row)
  } catch (err) {
    await fileStore.remove(attachmentId).catch(() => {})
    throw err
  }
}

export function sendReply(actor: Actor, id: string, input: { text: string; clientMsgId?: string; igReplyMode?: IgReplyMode; attachmentId?: string }) {
  return inTx(async (tx, effects) => {
    const conv = await loadFor(actor, tx, id)
    authorizeOnConversation(actor, 'conversation.reply', conv)

    if (input.clientMsgId) {
      const existing = await messageRepository.findByClientId(id, input.clientMsgId, tx)
      if (existing) return toMessageDto(existing) // a retry of a send that already landed
    }
    // Replying while the bot is still driving would have two voices answering
    // the customer at once. The app shows "Take over" prominently for this.
    if (conv.status !== 'agent') throw conflict('not_taken_over', 'Take over the conversation before replying')

    if (conv.channel === 'whatsapp' && !whatsappWindow(conv.last_inbound_at).open) {
      throw conflict('whatsapp_window_closed', 'The 24-hour window has closed — send an approved template instead',
        { expiresAt: whatsappWindow(conv.last_inbound_at).expiresAt })
    }
    let event: string | null = null
    if (conv.channel === 'instagram' && conv.source === 'comment') {
      if (!input.igReplyMode) throw badRequest('ig_reply_mode_required', 'Choose a public comment reply or a private reply')
      if (input.igReplyMode === 'private') {
        if (Date.now() - conv.created_at.getTime() > IG_PRIVATE_REPLY_WINDOW_MS) {
          throw conflict('ig_private_reply_expired', 'Private replies are only possible within 7 days of the comment')
        }
        const used = await tx.query(`SELECT 1 FROM messages WHERE conversation_id = $1 AND event = 'ig_private_reply'`, [id])
        if (used.rowCount) throw conflict('ig_private_reply_used', 'This comment has already had its private reply')
        event = 'ig_private_reply'
      } else {
        event = 'ig_public_reply'
      }
    }

    let attachment: AttachmentSnapshot | null = null
    if (input.attachmentId) {
      if (event === 'ig_public_reply') {
        throw badRequest('ig_public_reply_text_only', 'A public comment reply can only be text — send the file as a private reply')
      }
      const row = await attachmentRepository.findUnsentForConversation(input.attachmentId, id, tx)
      if (!row) throw badRequest('attachment_not_found', 'That file is no longer available — attach it again')
      attachment = snapshotOf(row)
    }
    if (!attachment && !input.text) throw badRequest('empty_message', 'Write a message or attach a file')

    const { message } = await appendMessage(tx, conv, {
      conversationId: id, type: 'outgoing', text: input.text, sender: 'Agent', agentId: actor.id, agentName: actor.name,
      delivery: 'pending', clientMsgId: input.clientMsgId ?? null, event, attachment,
    })
    if (attachment) await attachmentRepository.markSent(attachment.id, message.id, tx)
    effects.push(deliverLater(conv, message, attachment
      ? { kind: 'media', attachment, caption: input.text, igReplyMode: input.igReplyMode }
      : { kind: 'text', text: input.text, igReplyMode: input.igReplyMode }))
    return toMessageDto(message)
  })
}

/**
 * WhatsApp template send — the only way to message a customer outside the
 * 24-hour window. Sending one is taking ownership of the conversation, so an
 * unowned chat is assigned to the sender.
 */
export async function sendTemplate(actor: Actor, id: string, input: { templateId: string; variables: string[]; clientMsgId?: string }) {
  const template = await templateRepository.findById(input.templateId)
  if (!template || template.status !== 'APPROVED') throw badRequest('template_not_approved')
  let body: string
  try {
    body = renderTemplateBody(template.body, input.variables)
  } catch (err) {
    throw badRequest('template_variables_missing', (err as Error).message)
  }

  return inTx(async (tx, effects) => {
    let conv = await loadFor(actor, tx, id)
    if (conv.channel !== 'whatsapp') throw badRequest('templates_are_whatsapp_only')
    authorizeOnConversation(actor, 'conversation.reply', conv)
    if (input.clientMsgId) {
      const existing = await messageRepository.findByClientId(id, input.clientMsgId, tx)
      if (existing) return toMessageDto(existing)
    }
    if (conv.status !== 'agent') {
      await conversationRepository.update(id, { status: 'agent', agent_id: actor.id, needs_agent_since: null, resolved_at: null }, tx)
      conv = (await appendMessage(tx, await reload(tx, id), eventMessage(conv, 'assigned', `Assigned to ${actor.name}`))).conversation
    }
    const { message } = await appendMessage(tx, conv, {
      conversationId: id, type: 'template', text: body, sender: 'Agent', agentId: actor.id, agentName: actor.name,
      delivery: 'pending', clientMsgId: input.clientMsgId ?? null,
      template: {
        name: template.name, language: template.language, category: template.category, variables: input.variables,
        header: template.header, body, footer: template.footer, buttons: template.buttons,
      },
    })
    effects.push(deliverLater(conv, message, { kind: 'template', name: template.name, language: template.language, variables: input.variables }))
    return toMessageDto(message)
  })
}

// Shared with routingService / inboundService / conversationStartService so
// every write path records events and defers side effects the same way.
export { inTx, load, reload, appendMessage, emitUpdated, eventMessage, push, deliverLater }
export type { Effect }
