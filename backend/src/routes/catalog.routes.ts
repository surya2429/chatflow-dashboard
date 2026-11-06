import { Router, type Request, type Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ctwaConnectionRepository } from '../db/repositories/ctwaConnectionRepository.js'
import { createCatalogRuntime } from '../catalog/runtime.js'

export const catalogRouter = Router()

// The catalog shares the Facebook connection made in the Click-to-WhatsApp section; with none, the section shows an editable sample catalog.
const runtime = createCatalogRuntime({
  env: { version: env.WA_GRAPH_API_VERSION, token: env.WA_ACCESS_TOKEN, wabaId: env.WA_BUSINESS_ACCOUNT_ID, catalogId: env.META_CATALOG_ID },
  app: env.META_APP_ID && env.META_APP_SECRET && env.META_LOGIN_CONFIG_ID ? { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, configId: env.META_LOGIN_CONFIG_ID, version: env.WA_GRAPH_API_VERSION } : null,
  secret: env.CONNECTIONS_SECRET ?? env.AI_SETTINGS_SECRET,
  connections: ctwaConnectionRepository,
})

/* Until requests carry an authenticated client, one workspace stands in for it (as in ctwa.routes.ts and billing.routes.ts). */
catalogRouter.all('/whatsapp/catalog/*', async (req: Request, res: Response) => {
  try {
    const { status, body } = await runtime.handle({
      method: req.method, path: req.path.replace(/^\/whatsapp\/catalog/, '') || '/', query: req.query as Record<string, string>,
      body: (req.body ?? {}) as Record<string, unknown>, workspace: req.header('x-workspace-id') || 'default',
    })
    res.status(status).json(body)
  } catch (err) {
    logger.error({ err }, 'Catalog request failed')
    res.status(500).json({ error: 'internal_server_error' })
  }
})
