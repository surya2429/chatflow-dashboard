import { Router } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { metaReportResponse } from '../whatsapp/metaReports.js'

export const whatsappReportsRouter = Router()

/** GET /api/whatsapp/meta-reports?start=<unix>&end=<unix> — Meta's Insights figures for the WhatsApp Business Account. */
whatsappReportsRouter.get('/whatsapp/meta-reports', async (req, res) => {
  try {
    const { status, body } = await metaReportResponse(req.query, {
      wabaId: env.WA_BUSINESS_ACCOUNT_ID,
      accessToken: env.WA_ACCESS_TOKEN,
      version: env.WA_GRAPH_API_VERSION,
    })
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'Meta report failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
