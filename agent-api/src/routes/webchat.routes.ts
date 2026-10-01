import { randomBytes } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { parse, route } from '../http/async.js'
import { unauthorized, notFound } from '../http/errors.js'
import { signVisitorToken, verifyToken } from '../auth/tokens.js'
import { contactRepository } from '../db/repositories/contactRepository.js'
import { conversationRepository, messageRepository, toMessageDto } from '../db/repositories/conversationRepository.js'
import { ingestInbound } from '../services/inboundService.js'
import { requestHuman } from '../services/routingService.js'
import { openStream } from '../realtime/sseHub.js'
import { iceServersFor } from '../signaling/iceServers.js'

/**
 * The visitor side of Website Chat. A visitor has no account: identity is an
 * ephemeral id the widget generates and keeps in its own storage. Starting a
 * session hands back a token scoped to that visitor's one conversation — it
 * can post messages, read the public side of that thread, and open that
 * conversation's call room, nothing more.
 *
 * There is no production embeddable widget in this engagement (out of scope);
 * these endpoints are what one would call, and what the dev call tester and
 * scripts/simulate-inbound.ts use.
 */
export const webchatRouter = Router()

declare module 'express-serve-static-core' {
  interface Request { visitor?: { visitorId: string; conversationId: string } }
}

function requireVisitor(allowQuery = false) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7)
      : allowQuery && typeof req.query.token === 'string' ? req.query.token : undefined
    if (!token) return next(unauthorized('missing_token'))
    verifyToken(token, 'visitor').then((r) => {
      if (!r.ok || !r.claims.room) return next(unauthorized('invalid_token'))
      req.visitor = { visitorId: r.claims.sub, conversationId: r.claims.room }
      next()
    }).catch(next)
  }
}

/**
 * The visitor id is always generated here, never accepted from the caller: it
 * is effectively the visitor's credential, and taking one from the request
 * would let anyone who guessed an id read that visitor's thread. The returned
 * token (kept by the widget) is what resumes the conversation.
 */
const VISITOR_TOKEN_TTL_SECONDS = 30 * 86_400

const SessionBody = z.object({
  name: z.string().trim().max(256).optional(),
  meta: z.object({
    page: z.string().max(512).optional(), browser: z.string().max(64).optional(), os: z.string().max(64).optional(),
    location: z.string().max(128).optional(), referrer: z.string().max(256).optional(),
  }).optional(),
  firstMessage: z.string().trim().min(1).max(4096),
  /** The website bot this widget belongs to. */
  botId: z.string().uuid().optional(),
})

webchatRouter.post('/webchat/sessions', route(async (req, res) => {
  const body = parse(SessionBody, req.body)
  const visitorId = `v_${randomBytes(16).toString('hex')}`
  const now = new Date().toISOString()
  const { conversationId } = await ingestInbound({
    channel: 'webchat', visitorId,
    name: body.name || `Visitor #${visitorId.slice(-4).toUpperCase()}`,
    visitorMeta: { ...body.meta, visits: 1, firstSeen: now, lastSeen: now },
    text: body.firstMessage,
    botId: body.botId,
  })
  res.status(201).json({ visitorId, conversationId, token: await signVisitorToken(visitorId, conversationId, VISITOR_TOKEN_TTL_SECONDS) })
}))

webchatRouter.post('/webchat/messages', requireVisitor(), route(async (req, res) => {
  const body = parse(z.object({
    text: z.string().trim().min(1).max(4096).optional(),
    answer: z.object({ questionType: z.string().max(32), label: z.string().max(256), value: z.string().max(1024) }).optional(),
  }).refine(b => !!b.text !== !!b.answer, 'send exactly one of text or answer'), req.body)
  const v = req.visitor!
  const contact = await contactRepository.findByIdentity({ channel: 'webchat', visitorId: v.visitorId })
  if (!contact) throw notFound()
  const result = await ingestInbound({ channel: 'webchat', visitorId: v.visitorId, name: contact.name, text: body.text, answer: body.answer })
  res.status(201).json(result)
}))

webchatRouter.post('/webchat/request-agent', requireVisitor(), route(async (req, res) => {
  res.json(await requestHuman(req.visitor!.conversationId))
}))

webchatRouter.get('/webchat/messages', requireVisitor(), route(async (req, res) => {
  const conv = await conversationRepository.findById(req.visitor!.conversationId)
  if (!conv) throw notFound()
  const page = await messageRepository.page(conv.id, null, 100)
  res.json({ items: page.items.filter(m => ['incoming', 'outgoing', 'template', 'answer'].includes(m.type)).map(toMessageDto) })
}))

webchatRouter.get('/webchat/events', requireVisitor(true), route(async (req, res) => {
  await openStream(req, res, { kind: 'visitor', conversationId: req.visitor!.conversationId })
}))

webchatRouter.get('/webchat/ice-servers', requireVisitor(), route(async (req, res) => {
  res.json({ iceServers: iceServersFor(req.visitor!.visitorId) })
}))
