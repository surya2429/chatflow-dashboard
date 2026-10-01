import { Router } from 'express'
import { z } from 'zod'
import { parse, route } from '../http/async.js'
import { actorOf, requireStaff } from '../auth/middleware.js'
import { authorize } from '../auth/policy.js'
import * as auth from '../services/authService.js'

export const authRouter = Router()

const LoginBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  deviceId: z.string().min(8).max(128).optional(),
})

authRouter.post('/auth/login', route(async (req, res) => {
  const body = parse(LoginBody, req.body)
  res.json(await auth.login({ ...body, userAgent: req.header('user-agent'), ip: req.ip ?? 'unknown' }))
}))

const RefreshBody = z.object({ refreshToken: z.string().min(20).max(256) })

authRouter.post('/auth/refresh', route(async (req, res) => {
  res.json(await auth.refresh(parse(RefreshBody, req.body).refreshToken))
}))

// Deliberately unauthenticated: logging out must work with an expired access
// token, and the refresh token is itself the credential being revoked.
authRouter.post('/auth/logout', route(async (req, res) => {
  await auth.logout(parse(RefreshBody, req.body).refreshToken)
  res.status(204).end()
}))

authRouter.get('/auth/me', requireStaff(), route(async (req, res) => {
  res.json(await auth.me(actorOf(req).id))
}))

// ── Admin: user management ──────────────────────────────────────────────────

const Role = z.enum(['admin', 'supervisor', 'agent'])

authRouter.post('/users', requireStaff(), route(async (req, res) => {
  authorize(actorOf(req), 'user.manage')
  const body = parse(z.object({
    email: z.string().email(), password: z.string().min(10).max(256), name: z.string().min(1).max(256),
    role: Role, color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  }), req.body)
  res.status(201).json(await auth.createUser(body))
}))

authRouter.patch('/users/:id', requireStaff(), route(async (req, res) => {
  authorize(actorOf(req), 'user.manage')
  const body = parse(z.object({
    name: z.string().min(1).max(256).optional(), role: Role.optional(), isActive: z.boolean().optional(),
    maxConcurrent: z.number().int().min(0).max(100).optional(),
  }), req.body)
  res.json(await auth.updateUser(req.params.id!, body))
}))
