import { Router, type Request, type Response } from 'express'
import { logger } from '../config/logger.js'
import { transcriptRepository } from '../db/repositories/transcriptRepository.js'
import { createRateLimiter } from '../leads/poweredByLead.js'
import { viewTranscript } from '../transcripts/transcripts.js'

export const transcriptsRouter = Router()

const allow = createRateLimiter(60, 60_000) // per IP: a person reads a page, a scraper hammers it

/* GET /api/webchat/transcripts/:token — public (no login): the page an email links to. There is deliberately no public
   "create" route: transcripts are published by the server-side sender (publishTranscript), never by a visitor's browser. */
transcriptsRouter.get('/webchat/transcripts/:token', async (req: Request, res: Response) => {
  try {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' })
    if (!allow(req.ip ?? 'unknown')) { res.status(429).json({ error: 'rate_limited' }); return }
    const r = await viewTranscript(String(req.params.token), transcriptRepository)
    res.status(r.status).json(r.body)
  } catch (err) {
    logger.error({ err }, 'Transcript fetch failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
