import { Router, type Request, type Response } from 'express'
import { logger } from '../config/logger.js'
import { mediaRepository } from '../db/repositories/mediaRepository.js'
import { createRateLimiter } from '../leads/poweredByLead.js'
import { handleGet, handleUpload } from '../media/media.js'

export const mediaRouter = Router()

const allowUpload = createRateLimiter(30, 60_000) // per IP

/* Until requests carry an authenticated client, uploads are open like the other dashboard routes: limited by size, by file
   type (checked from the bytes) and by this rate limit. */
mediaRouter.post('/api/webchat-media', async (req: Request, res: Response) => {
  try {
    if (!allowUpload(req.ip ?? 'unknown')) { res.status(429).json({ error: 'rate_limited', message: 'Too many uploads. Wait a minute and try again.' }); return }
    const r = await handleUpload(req.query.bot, req.body, mediaRepository)
    res.status(r.status).json(r.body)
  } catch (err) {
    logger.error({ err }, 'Media upload failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})

mediaRouter.get('/api/webchat-media/:file', async (req: Request, res: Response) => {
  try {
    const r = await handleGet(String(req.params.file), req.header('range'), mediaRepository)
    res.status(r.status).set(r.headers).end(r.body)
  } catch (err) {
    logger.error({ err }, 'Media fetch failed')
    res.status(500).end()
  }
})
