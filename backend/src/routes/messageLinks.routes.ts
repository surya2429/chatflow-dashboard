import { Router, type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { messageLinkResponse } from '../whatsapp/messageLinks.js'

export const messageLinksRouter = Router()

/* WhatsApp message links / QR codes on the business phone number (see whatsapp/messageLinks.ts). */
async function run(req: Request, res: Response): Promise<void> {
  try {
    const { status, body } = await messageLinkResponse(
      { method: req.method, code: req.params.code, body: req.body as Record<string, unknown> },
      { phoneNumberId: env.WA_PHONE_NUMBER_ID, accessToken: env.WA_ACCESS_TOKEN, version: env.WA_GRAPH_API_VERSION },
    )
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'Message link request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
}

messageLinksRouter.get('/whatsapp/message-links', run)
messageLinksRouter.post('/whatsapp/message-links', run)
messageLinksRouter.put('/whatsapp/message-links/:code', run)
messageLinksRouter.delete('/whatsapp/message-links/:code', run)
