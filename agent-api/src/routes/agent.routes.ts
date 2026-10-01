import { Router } from 'express'
import { z } from 'zod'
import { parse, route } from '../http/async.js'
import { actorOf, requireStaff } from '../auth/middleware.js'
import { authorize, can } from '../auth/policy.js'
import { userRepository, toUserDto } from '../db/repositories/userRepository.js'
import { deviceRepository } from '../db/repositories/deviceRepository.js'
import { setPresence } from '../services/routingService.js'
import { openStream } from '../realtime/sseHub.js'
import { visibleBotIds } from '../db/repositories/botRepository.js'
import { iceServersFor, turnConfigured } from '../signaling/iceServers.js'
import { getNotificationSettings, updateNotificationSettings } from '../push/preferences.js'

/**
 * The agent's own state: presence, devices, live stream, call config.
 */
export const agentRouter = Router()

// EventSource can't send headers — the query-token exception lives here only.
agentRouter.get('/events', requireStaff({ allowQueryToken: true }), route(async (req, res) => {
  const actor = actorOf(req)
  await openStream(req, res, { kind: 'staff', userId: actor.id, scope: await visibleBotIds(actor) })
}))

agentRouter.use(requireStaff())

agentRouter.get('/team', route(async (req, res) => {
  const actor = actorOf(req)
  authorize(actor, 'team.read')
  const users = await userRepository.listActive()
  // Everyone can see who they could transfer to and whether that person is
  // around; only supervisors see emails.
  const showDetail = can(actor, 'team.presence.read')
  res.json({
    items: users.map(u => {
      const dto = toUserDto(u)
      return showDetail ? dto : { ...dto, email: undefined }
    }),
  })
}))

agentRouter.put('/me/presence', route(async (req, res) => {
  const { presence } = parse(z.object({ presence: z.enum(['online', 'away', 'offline']) }), req.body)
  res.json(await setPresence(actorOf(req), presence))
}))

// Sent by the app every minute or so while in the foreground. Keeps an
// "online" agent online; its absence (dead phone, killed app) lets the
// sweeper demote them to away so they stop receiving new chats.
agentRouter.post('/me/heartbeat', route(async (req, res) => {
  await userRepository.heartbeat(actorOf(req).id)
  res.status(204).end()
}))

agentRouter.put('/me/devices', route(async (req, res) => {
  const body = parse(z.object({
    deviceId: z.string().min(8).max(128),
    platform: z.enum(['ios', 'android']),
    pushToken: z.string().min(10).max(4096).nullable().optional(),
    voipToken: z.string().min(10).max(4096).nullable().optional(),
    appVersion: z.string().max(32).optional(),
  }), req.body)
  const device = await deviceRepository.upsert({ userId: actorOf(req).id, ...body })
  res.json({ deviceId: device.device_id, platform: device.platform })
}))

agentRouter.delete('/me/devices/:deviceId', route(async (req, res) => {
  await deviceRepository.removeForUserDevice(actorOf(req).id, req.params.deviceId!)
  res.status(204).end()
}))

// Push preferences: categories follow the person; pushEnabled is this phone's switch.
agentRouter.get('/me/notifications', route(async (req, res) => {
  const { deviceId } = parse(z.object({ deviceId: z.string().min(8).max(128).optional() }), req.query)
  res.json(await getNotificationSettings(actorOf(req).id, deviceId))
}))

agentRouter.put('/me/notifications', route(async (req, res) => {
  const body = parse(z.object({
    categories: z.object({
      assignments: z.boolean(), messages: z.boolean(), waiting: z.boolean(), calls: z.boolean(),
    }).partial().strict().optional(),
    deviceId: z.string().min(8).max(128).optional(),
    pushEnabled: z.boolean().optional(),
  }).refine(b => !(b.pushEnabled !== undefined && !b.deviceId), { message: 'pushEnabled needs a deviceId' }), req.body)
  res.json(await updateNotificationSettings(actorOf(req).id, body))
}))

agentRouter.get('/calls/ice-servers', route(async (req, res) => {
  const actor = actorOf(req)
  authorize(actor, 'call.place')
  res.json({ iceServers: iceServersFor(actor.id), turn: turnConfigured() })
}))
