import { timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { parse, route } from '../http/async.js'
import { notFound, unauthorized } from '../http/errors.js'
import { applyDeliveryStatus, ingestInbound, recordBotMessage } from '../services/inboundService.js'
import { requestHuman } from '../services/routingService.js'
import { signVisitorToken } from '../auth/tokens.js'
import { recentPushes } from '../push/notificationService.js'
import { conversationRepository } from '../db/repositories/conversationRepository.js'

/**
 * Service-to-service entry points. The WhatsApp/Instagram webhook pipeline
 * (backend/ — signature verification, dedupe, queues) stays where it is and
 * forwards normalized events here, authenticated with a shared key. This
 * service never faces Meta's webhooks directly.
 */
export const internalRouter = Router()

function requireInternalKey(req: Request, _res: Response, next: NextFunction) {
  const given = Buffer.from(req.header('x-internal-key') ?? '')
  const expected = Buffer.from(env.INTERNAL_API_KEY)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return next(unauthorized('invalid_internal_key'))
  next()
}
internalRouter.use(requireInternalKey)

const Inbound = z.object({
  channel: z.enum(['whatsapp', 'instagram', 'webchat']),
  phone: z.string().max(32).optional(),
  handle: z.string().max(64).optional(),
  visitorId: z.string().max(64).optional(),
  name: z.string().min(1).max(256),
  externalUserId: z.string().max(128).optional(),
  externalMessageId: z.string().max(128).optional(),
  source: z.string().max(32).optional(),
  externalRef: z.string().max(128).optional(),
  isFollower: z.boolean().optional(),
  visitorMeta: z.record(z.unknown()).optional(),
  botId: z.string().uuid().optional(),
  text: z.string().max(4096).optional(),
  answer: z.object({ questionType: z.string(), label: z.string(), value: z.string() }).optional(),
}).refine(b => (b.channel === 'whatsapp' ? !!b.phone : b.channel === 'instagram' ? !!b.handle : !!b.visitorId),
  'identity field for the channel is required (phone | handle | visitorId)')
  .refine(b => !!b.text !== !!b.answer, 'send exactly one of text or answer')
  .refine(b => b.channel !== 'instagram' || b.source !== 'comment' || !!b.externalRef, 'comments need externalRef (comment id)')

internalRouter.post('/inbound', route(async (req, res) => {
  res.status(201).json(await ingestInbound(parse(Inbound, req.body)))
}))

internalRouter.post('/conversations/:id/bot-message', route(async (req, res) => {
  const { text } = parse(z.object({ text: z.string().min(1).max(4096) }), req.body)
  res.status(201).json(await recordBotMessage(parse(z.string().uuid(), req.params.id), text))
}))

internalRouter.post('/conversations/:id/handover', route(async (req, res) => {
  res.json(await requestHuman(parse(z.string().uuid(), req.params.id)))
}))

internalRouter.post('/delivery', route(async (req, res) => {
  const body = parse(z.object({ externalId: z.string().min(1).max(128), status: z.enum(['sent', 'delivered', 'read', 'failed']) }), req.body)
  res.json({ applied: await applyDeliveryStatus(body.externalId, body.status) })
}))

// For the widget backend (and the dev call tester): a visitor token for an
// existing Website Chat conversation, e.g. one created before tokens existed.
internalRouter.post('/webchat/visitor-token', route(async (req, res) => {
  const { conversationId } = parse(z.object({ conversationId: z.string().uuid() }), req.body)
  const conv = await conversationRepository.findById(conversationId)
  if (!conv || conv.channel !== 'webchat' || !conv.visitor_id) throw notFound('conversation_not_found')
  res.json({ visitorId: conv.visitor_id, conversationId, token: await signVisitorToken(conv.visitor_id, conversationId) })
}))

// Development/test only: what push dispatch decided, including pushes that
// were logged instead of sent because no provider is configured.
if (env.NODE_ENV !== 'production') {
  internalRouter.get('/debug/pushes', (_req, res) => { res.json({ items: recentPushes() }) })
}
