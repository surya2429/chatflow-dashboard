import { Router } from 'express'
import { z } from 'zod'
import { parse, route } from '../http/async.js'
import { actorOf, requireStaff } from '../auth/middleware.js'
import { agentAnalytics } from '../services/analyticsService.js'

// A real calendar date — the regex alone would let 2026-02-31 through to Postgres.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => {
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d)
}, 'Use a real date as YYYY-MM-DD')

export const analyticsRouter = Router()
analyticsRouter.use(requireStaff())

// GET /api/analytics/agent?range=7d&tz=Asia/Kolkata[&agentId=…]
//     /api/analytics/agent?range=custom&from=2026-09-01&to=2026-09-15&tz=…
// Agents see their own numbers; supervisors and admins may pass any agentId.
analyticsRouter.get('/analytics/agent', route(async (req, res) => {
  const q = parse(z.object({
    range: z.enum(['today', '7d', '30d', 'custom']).default('7d'),
    from: isoDate.optional(),
    to: isoDate.optional(),
    tz: z.string().max(64).optional(),
    agentId: z.string().uuid().optional(),
  }), req.query)
  res.json(await agentAnalytics(actorOf(req), q))
}))
