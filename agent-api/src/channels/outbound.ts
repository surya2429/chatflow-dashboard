import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import type { ConversationRow } from '../db/repositories/conversationRepository.js'
import type { AttachmentSnapshot } from '../db/repositories/attachmentRepository.js'
import { publicFileUrl } from '../storage/signedUrl.js'

/**
 * Hands an agent's reply to the channel it belongs to.
 *
 * WhatsApp and Instagram go out through Meta's Graph API when credentials are
 * configured, and are logged (and marked sent) when they aren't, so the whole
 * loop runs locally. Website Chat has no provider: the visitor's widget
 * receives the message over its own event stream (GET /api/webchat/events).
 *
 * Instagram is not one channel but three reply mechanisms that share an inbox:
 *   dm      → a message in the DM thread
 *   story   → story replies arrive in DMs, so the answer is a DM too
 *   comment → either a PUBLIC reply under the comment, or a PRIVATE reply,
 *             which Meta allows once per comment (within 7 days) and which
 *             lands in the commenter's DMs.
 */
export type IgReplyMode = 'public' | 'private'

export type OutboundContent =
  | { kind: 'text'; text: string; igReplyMode?: IgReplyMode }
  | { kind: 'template'; name: string; language: string; variables: string[] }
  | { kind: 'media'; attachment: AttachmentSnapshot; caption: string; igReplyMode?: IgReplyMode }

/** Meta downloads media from us, so it needs a public, signed link. */
function mediaLink(a: AttachmentSnapshot): string {
  const url = publicFileUrl(a.id, a.name)
  if (!url) throw new ChannelSendError('PUBLIC_BASE_URL must be set to send attachments on this channel')
  return url
}

export interface OutboundResult { externalId: string | null; simulated: boolean }

export class ChannelSendError extends Error {
  constructor(message: string, readonly providerCode?: string) { super(message) }
}

async function graphPost(url: string, token: string, body: unknown): Promise<{ id?: string; messages?: { id: string }[] }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { id?: string; messages?: { id: string }[]; error?: { message?: string; code?: number } }
  if (!res.ok) throw new ChannelSendError(json.error?.message ?? `Graph API ${res.status}`, String(json.error?.code ?? res.status))
  return json
}

async function sendWhatsApp(conv: ConversationRow, content: OutboundContent): Promise<OutboundResult> {
  const to = conv.external_id ?? conv.phone?.replace(/[^\d]/g, '')
  if (!env.WA_ACCESS_TOKEN || !env.WA_PHONE_NUMBER_ID) {
    logger.info({ to, content }, '[channel:whatsapp] (not configured) would send')
    return { externalId: null, simulated: true }
  }
  const url = `https://graph.facebook.com/${env.WA_GRAPH_API_VERSION}/${env.WA_PHONE_NUMBER_ID}/messages`
  if (content.kind === 'media') {
    const a = content.attachment
    const type = a.kind
    // Audio can't carry a caption; it follows as its own text message.
    const media: Record<string, string> = { link: mediaLink(a) }
    if (content.caption && type !== 'audio') media.caption = content.caption
    if (type === 'document') media.filename = a.name
    const json = await graphPost(url, env.WA_ACCESS_TOKEN, { messaging_product: 'whatsapp', to, type, [type]: media })
    if (content.caption && type === 'audio') {
      await graphPost(url, env.WA_ACCESS_TOKEN, { messaging_product: 'whatsapp', to, type: 'text', text: { body: content.caption } })
    }
    return { externalId: json.messages?.[0]?.id ?? null, simulated: false }
  }
  const body = content.kind === 'text'
    ? { messaging_product: 'whatsapp', to, type: 'text', text: { body: content.text } }
    : {
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: content.name,
          language: { code: content.language },
          components: content.variables.length
            ? [{ type: 'body', parameters: content.variables.map(text => ({ type: 'text', text })) }]
            : [],
        },
      }
  const json = await graphPost(url, env.WA_ACCESS_TOKEN, body)
  return { externalId: json.messages?.[0]?.id ?? null, simulated: false }
}

async function sendInstagram(conv: ConversationRow, content: OutboundContent): Promise<OutboundResult> {
  if (content.kind === 'template') throw new ChannelSendError('Instagram has no message templates')
  if (!env.IG_ACCESS_TOKEN || !env.IG_ACCOUNT_ID) {
    logger.info({ source: conv.source, handle: conv.handle, mode: content.igReplyMode, content }, '[channel:instagram] (not configured) would send')
    return { externalId: null, simulated: true }
  }
  const base = `https://graph.instagram.com/${env.IG_GRAPH_API_VERSION}`
  if (content.kind === 'media') {
    // DMs only (the service refuses media as a public comment reply). No captions
    // on Instagram attachments, so a caption goes as a second message.
    const recipient = conv.source === 'comment' ? { comment_id: conv.external_ref } : { id: conv.external_id }
    const a = content.attachment
    const type = a.kind === 'document' ? 'file' : a.kind
    const json = await graphPost(`${base}/${env.IG_ACCOUNT_ID}/messages`, env.IG_ACCESS_TOKEN,
      { recipient, message: { attachment: { type, payload: { url: mediaLink(a) } } } })
    if (content.caption) {
      await graphPost(`${base}/${env.IG_ACCOUNT_ID}/messages`, env.IG_ACCESS_TOKEN,
        { recipient: conv.source === 'comment' ? { id: conv.external_id } : recipient, message: { text: content.caption } })
    }
    return { externalId: (json as { message_id?: string }).message_id ?? null, simulated: false }
  }
  if (conv.source === 'comment' && content.igReplyMode === 'public') {
    const json = await graphPost(`${base}/${conv.external_ref}/replies`, env.IG_ACCESS_TOKEN, { message: content.text })
    return { externalId: json.id ?? null, simulated: false }
  }
  const recipient = conv.source === 'comment' ? { comment_id: conv.external_ref } : { id: conv.external_id }
  const json = await graphPost(`${base}/${env.IG_ACCOUNT_ID}/messages`, env.IG_ACCESS_TOKEN, { recipient, message: { text: content.text } })
  return { externalId: (json as { message_id?: string }).message_id ?? null, simulated: false }
}

export async function deliverOutbound(conv: ConversationRow, content: OutboundContent): Promise<OutboundResult> {
  switch (conv.channel) {
    case 'whatsapp': return sendWhatsApp(conv, content)
    case 'instagram': return sendInstagram(conv, content)
    case 'webchat': return { externalId: null, simulated: false }
  }
}
