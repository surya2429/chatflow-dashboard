import { Router, type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ctwaRepository } from '../db/repositories/ctwaRepository.js'
import { createCtwa } from '../ctwa/factory.js'
import { handleCtwaRequest } from '../ctwa/service.js'

export const ctwaRouter = Router()

// Live (Meta Marketing API + Postgres) when META_AD_ACCOUNT_ID, META_PAGE_ID and a token are set; sample data otherwise.
const deps = createCtwa({
  adAccountId: env.META_AD_ACCOUNT_ID, pageId: env.META_PAGE_ID, adsToken: env.META_ADS_ACCESS_TOKEN, waToken: env.WA_ACCESS_TOKEN,
  version: env.WA_GRAPH_API_VERSION, whatsappNumber: env.CTWA_WHATSAPP_NUMBER, wabaId: env.WA_BUSINESS_ACCOUNT_ID, datasetId: env.META_CAPI_DATASET_ID, partnerAgent: env.CTWA_PARTNER_AGENT,
}, ctwaRepository)

/* Until requests carry an authenticated client, anyone who can reach the API is the workspace owner (as in billing.routes.ts). */
ctwaRouter.all('/whatsapp/ctwa/*', async (req: Request, res: Response) => {
  try {
    const { status, body } = await handleCtwaRequest(
      { method: req.method, path: req.path.replace(/^\/whatsapp\/ctwa/, '') || '/', query: req.query as Record<string, string>, body: (req.body ?? {}) as Record<string, unknown> },
      deps,
    )
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'CTWA request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
