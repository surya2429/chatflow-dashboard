import express, { Router } from 'express'
import { env } from '../config/env.js'
import { z } from 'zod'
import { parse, route } from '../http/async.js'
import { actorOf, requireStaff } from '../auth/middleware.js'
import { authorize } from '../auth/policy.js'
import { conversationRepository, toConversationDto } from '../db/repositories/conversationRepository.js'
import { templateRepository, toTemplateDto } from '../db/repositories/templateRepository.js'
import * as inbox from '../services/inboxService.js'
import * as contacts from '../services/contactService.js'
import { botRepository, visibleBotIds } from '../db/repositories/botRepository.js'

export const conversationsRouter = Router()
conversationsRouter.use(requireStaff())

const uuid = z.string().uuid()
const Channel = z.enum(['whatsapp', 'instagram', 'webchat'])
const Status = z.enum(['bot', 'agent', 'resolved'])
const csv = z.string().transform(s => s.split(',').map(x => x.trim()).filter(Boolean))
const flag = z.enum(['true', 'false']).transform(v => v === 'true')

const ListQuery = z.object({
  view: z.enum(['all', 'active', 'mine', 'unassigned', 'waiting']).optional(),
  botIds: csv.pipe(z.array(uuid)).optional(),
  channels: csv.pipe(z.array(Channel)).optional(),
  sort: z.enum(['recent', 'oldest', 'unread', 'waiting']).optional(),
  bucket: z.enum(['open', 'pending', 'solved', 'unread', 'favourite', 'last24h']).optional(),
  channel: Channel.optional(),
  source: z.string().max(32).optional(),
  status: csv.pipe(z.array(Status)).optional(),
  agentId: uuid.optional(),
  labels: csv.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  starred: flag.optional(),
  unread: flag.optional(),
  archived: flag.optional(),
  includeSnoozed: flag.optional(),
  q: z.string().max(200).optional(),
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

conversationsRouter.get('/conversations', route(async (req, res) => {
  const actor = actorOf(req)
  authorize(actor, 'conversation.read')
  const f = parse(ListQuery, req.query)
  const { items, nextCursor } = await conversationRepository.list(actor.id, { ...f, scope: await visibleBotIds(actor) })
  res.json({ items: items.map(toConversationDto), nextCursor })
}))

conversationsRouter.get('/conversations/counts', route(async (req, res) => {
  const actor = actorOf(req)
  authorize(actor, 'conversation.read')
  const { channel, botId } = parse(z.object({ channel: Channel.optional(), botId: uuid.optional() }), req.query)
  res.json(await conversationRepository.counts(actor.id, { channel, botId, scope: await visibleBotIds(actor) }))
}))

// Home screen: the bots this person works, with live counts.
conversationsRouter.get('/bots', route(async (req, res) => {
  const actor = actorOf(req)
  authorize(actor, 'conversation.read')
  res.json({ items: await botRepository.listForActor(actor) })
}))

conversationsRouter.get('/conversations/:id', route(async (req, res) => {
  res.json(await inbox.getConversation(actorOf(req), parse(uuid, req.params.id)))
}))

conversationsRouter.get('/conversations/:id/messages', route(async (req, res) => {
  const q = parse(z.object({ before: uuid.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query)
  res.json(await inbox.getMessages(actorOf(req), parse(uuid, req.params.id), q.before ?? null, q.limit))
}))

const clientMsgId = z.string().min(8).max(64).optional()

conversationsRouter.post('/conversations/:id/messages', route(async (req, res) => {
  const body = parse(z.object({
    text: z.string().trim().max(4096).default(''),
    clientMsgId,
    igReplyMode: z.enum(['public', 'private']).optional(),
    // From POST /conversations/:id/attachments; the text becomes its caption.
    attachmentId: uuid.optional(),
  }).refine(b => b.text.length > 0 || b.attachmentId, { message: 'Write a message or attach a file' }), req.body)
  res.status(201).json(await inbox.sendReply(actorOf(req), parse(uuid, req.params.id), body))
}))

// The raw file is the request body: Content-Type is its type, X-File-Name its
// (URI-encoded) name. Returns the attachment to reference from a reply.
conversationsRouter.post('/conversations/:id/attachments',
  express.raw({ type: () => true, limit: `${env.MAX_UPLOAD_MB}mb` }),
  route(async (req, res) => {
    let name: string | undefined
    try { name = decodeURIComponent(String(req.headers['x-file-name'] ?? '')) } catch { name = undefined }
    res.status(201).json(await inbox.uploadAttachment(actorOf(req), parse(uuid, req.params.id), {
      mime: String(req.headers['content-type'] ?? ''),
      name,
      data: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
    }))
  }))

conversationsRouter.post('/conversations/:id/templates', route(async (req, res) => {
  const body = parse(z.object({ templateId: uuid, variables: z.array(z.string().max(1024)).max(20), clientMsgId }), req.body)
  res.status(201).json(await inbox.sendTemplate(actorOf(req), parse(uuid, req.params.id), body))
}))

conversationsRouter.post('/conversations/:id/notes', route(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(4096) }), req.body)
  res.status(201).json(await inbox.addNote(actorOf(req), parse(uuid, req.params.id), text))
}))

// ── Actions ────────────────────────────────────────────────────────────────
// One POST per verb rather than a generic PATCH, because each is a distinct
// authorization decision and writes its own thread event.

const idOf = (p: Record<string, string>) => parse(uuid, p.id)

conversationsRouter.post('/conversations/:id/read', route(async (req, res) => {
  res.json(await inbox.markRead(actorOf(req), idOf(req.params)))
}))
conversationsRouter.post('/conversations/:id/takeover', route(async (req, res) => {
  res.json(await inbox.takeOver(actorOf(req), idOf(req.params)))
}))
conversationsRouter.post('/conversations/:id/transfer', route(async (req, res) => {
  const { toUserId } = parse(z.object({ toUserId: uuid }), req.body)
  res.json(await inbox.transfer(actorOf(req), idOf(req.params), toUserId))
}))
conversationsRouter.post('/conversations/:id/resolve', route(async (req, res) => {
  res.json(await inbox.resolve(actorOf(req), idOf(req.params)))
}))
conversationsRouter.post('/conversations/:id/return-to-bot', route(async (req, res) => {
  res.json(await inbox.returnToBot(actorOf(req), idOf(req.params)))
}))
conversationsRouter.post('/conversations/:id/snooze', route(async (req, res) => {
  const { until } = parse(z.object({ until: z.string().datetime().nullable() }), req.body)
  res.json(await inbox.snooze(actorOf(req), idOf(req.params), until ? new Date(until) : null))
}))
conversationsRouter.post('/conversations/:id/star', route(async (req, res) => {
  const { starred } = parse(z.object({ starred: z.boolean() }), req.body)
  res.json(await inbox.setStarred(actorOf(req), idOf(req.params), starred))
}))
conversationsRouter.post('/conversations/:id/archive', route(async (req, res) => {
  const { archived } = parse(z.object({ archived: z.boolean() }), req.body)
  res.json(await inbox.setArchived(actorOf(req), idOf(req.params), archived))
}))
conversationsRouter.post('/conversations/:id/labels', route(async (req, res) => {
  const { label } = parse(z.object({ label: z.string().trim().min(1).max(48) }), req.body)
  res.json(await inbox.addLabel(actorOf(req), idOf(req.params), label))
}))
conversationsRouter.delete('/conversations/:id/labels/:label', route(async (req, res) => {
  res.json(await inbox.removeLabel(actorOf(req), idOf(req.params), req.params.label!))
}))

// ── Starting conversations ─────────────────────────────────────────────────

conversationsRouter.post('/conversations/start/whatsapp', route(async (req, res) => {
  const body = parse(z.object({
    phone: z.string().min(6).max(32), name: z.string().trim().min(1).max(256),
    templateId: uuid, variables: z.array(z.string().max(1024)).max(20), clientMsgId, botId: uuid.optional(),
  }), req.body)
  res.status(201).json(await contacts.startWhatsApp(actorOf(req), body))
}))

conversationsRouter.post('/conversations/start/instagram', route(async (req, res) => {
  const body = parse(z.object({ contactId: uuid, text: z.string().trim().min(1).max(1000), clientMsgId, botId: uuid.optional() }), req.body)
  res.status(201).json(await contacts.startInstagram(actorOf(req), body))
}))

conversationsRouter.get('/instagram/followers', route(async (req, res) => {
  const { q } = parse(z.object({ q: z.string().max(100).optional() }), req.query)
  res.json({ items: await contacts.listInstagramFollowers(actorOf(req), q) })
}))

// ── Contacts & templates ───────────────────────────────────────────────────

conversationsRouter.get('/contacts/:id', route(async (req, res) => {
  res.json(await contacts.getContactPanel(actorOf(req), idOf(req.params)))
}))

conversationsRouter.patch('/contacts/:id', route(async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(1).max(256).optional(),
    profile: z.record(z.union([z.string().max(1024), z.null()])).optional(),
    customFields: z.record(z.union([z.string().max(1024), z.number(), z.boolean(), z.null()])).optional(),
  }), req.body)
  res.json(await contacts.updateContact(actorOf(req), idOf(req.params), body))
}))

conversationsRouter.get('/templates', route(async (req, res) => {
  authorize(actorOf(req), 'conversation.read')
  res.json({ items: (await templateRepository.listApproved()).map(toTemplateDto) })
}))
