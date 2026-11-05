import { Router } from 'express'
import { logger } from '../config/logger.js'
import { leadRepository } from '../db/repositories/leadRepository.js'
import { createRateLimiter, handleLeadRequest } from '../leads/poweredByLead.js'

export const leadsRouter = Router()

// Public endpoint (the widget runs on other people's sites): five submissions per address per ten minutes.
const allow = createRateLimiter(5, 10 * 60_000)

/** POST /api/leads/powered-by — the "Powered by SmatBot" form: { name, email, phone, company?, website?, sourceUrl? } */
leadsRouter.post('/leads/powered-by', async (req, res) => {
  try {
    const { status, body } = await handleLeadRequest(req.body, req.ip ?? 'unknown', (l) => leadRepository.createDemoLead(l), allow)
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'Saving a Powered-by lead failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
