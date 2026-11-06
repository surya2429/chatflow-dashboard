import { Router, type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ctwaConnectionRepository } from '../db/repositories/ctwaConnectionRepository.js'
import { ctwaRepository } from '../db/repositories/ctwaRepository.js'
import { createRateLimiter } from '../leads/poweredByLead.js'
import { createRuntime } from '../ctwa/runtime.js'

export const ctwaRouter = Router()

// The customer connects their Meta account with the Facebook popup (needs META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID).
// Credentials set in the environment still work as before; with neither, the section shows editable sample data.
const runtime = createRuntime({
  env: {
    adAccountId: env.META_AD_ACCOUNT_ID, pageId: env.META_PAGE_ID, adsToken: env.META_ADS_ACCESS_TOKEN, waToken: env.WA_ACCESS_TOKEN,
    version: env.WA_GRAPH_API_VERSION, whatsappNumber: env.CTWA_WHATSAPP_NUMBER, wabaId: env.WA_BUSINESS_ACCOUNT_ID, datasetId: env.META_CAPI_DATASET_ID, partnerAgent: env.CTWA_PARTNER_AGENT,
  },
  app: env.META_APP_ID && env.META_APP_SECRET && env.META_LOGIN_CONFIG_ID ? { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, configId: env.META_LOGIN_CONFIG_ID, version: env.WA_GRAPH_API_VERSION } : null,
  secret: env.CONNECTIONS_SECRET ?? env.AI_SETTINGS_SECRET,
  connections: ctwaConnectionRepository,
  liveStore: ctwaRepository,
  allow: createRateLimiter(10, 60_000),
})

/* Until requests carry an authenticated client, one workspace stands in for it (as in billing.routes.ts). */
ctwaRouter.all('/whatsapp/ctwa/*', async (req: Request, res: Response) => {
  try {
    const { status, body } = await runtime.handle({
      method: req.method, path: req.path.replace(/^\/whatsapp\/ctwa/, '') || '/', query: req.query as Record<string, string>,
      body: (req.body ?? {}) as Record<string, unknown>, workspace: req.header('x-workspace-id') || 'default', ip: req.ip ?? 'unknown',
    })
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'CTWA request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
