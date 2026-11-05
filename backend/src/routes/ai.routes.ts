import { Router, type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { aiSettingsRepository } from '../db/repositories/aiSettingsRepository.js'
import { handleAiRequest } from '../ai/aiAssistant.js'
import { createRateLimiter } from '../leads/poweredByLead.js'

export const aiRouter = Router()

const allow = createRateLimiter(30, 60_000)   // 30 AI calls a minute per address: each one spends the customer's own key

/* Until requests carry an authenticated client, one workspace stands in for it (as in billing.routes.ts). */
async function run(route: 'settings' | 'run', req: Request, res: Response): Promise<void> {
  try {
    const { status, body } = await handleAiRequest(
      { method: req.method, route, workspace: req.header('x-workspace-id') || 'default', body: (req.body ?? {}) as Record<string, unknown>, ip: req.ip ?? 'unknown' },
      { store: aiSettingsRepository, secret: env.AI_SETTINGS_SECRET, allow },
    )
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'AI request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
}

aiRouter.all('/ai/settings', (req, res) => run('settings', req, res))
aiRouter.post('/ai/run', (req, res) => run('run', req, res))
