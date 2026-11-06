// runtime.ts — which Meta account the catalog section talks to, decided per request. It reuses the Facebook connection
// of the Click-to-WhatsApp section (same popup, same stored token), so a customer connects once:
//   1. the account connected through Facebook's popup  → live
//   2. else a catalog fixed in the server settings (META_CATALOG_ID + the WhatsApp token) → live
//   3. else an editable sample catalog                                                       → sample
import { decryptKey } from '../ai/aiAssistant.js'
import type { ConnectionStore, MetaApp } from '../ctwa/connect.js'
import { createMetaCatalog } from './meta.js'
import { createSampleCatalog } from './sample.js'
import { handleCatalogRequest, type CatalogRequest } from './service.js'
import { CatalogError, type CatalogBackend } from './types.js'

export interface CatalogRuntimeConfig {
  env: { version: string; token?: string; wabaId?: string; catalogId?: string }
  app: MetaApp | null
  secret: string | undefined
  connections: ConnectionStore
  fetchImpl?: typeof fetch
}

export function createCatalogRuntime(cfg: CatalogRuntimeConfig) {
  const sample = createSampleCatalog()                     // one per process, so edits made in sample mode stay until the server restarts

  async function backend(ws: string): Promise<CatalogBackend> {
    const stored = await cfg.connections.load(ws)
    const common = { version: cfg.env.version, fetchImpl: cfg.fetchImpl, app: cfg.app ? { appId: cfg.app.appId, appSecret: cfg.app.appSecret } : null }
    if (stored && cfg.secret) return createMetaCatalog({ ...common, token: decryptKey(stored.tokenEnc, cfg.secret), businessId: stored.businessId, wabaId: stored.selected.wabaId ?? cfg.env.wabaId })
    if (cfg.env.catalogId && cfg.env.token) return createMetaCatalog({ ...common, token: cfg.env.token, wabaId: cfg.env.wabaId, fixedCatalogId: cfg.env.catalogId })
    return sample
  }

  return {
    async handle(r: CatalogRequest & { workspace: string }): Promise<{ status: number; body: unknown }> {
      try { return await handleCatalogRequest(r, await backend(r.workspace)) }
      catch (err) {
        if (err instanceof CatalogError) return { status: err.status, body: { error: err.code, message: err.message } }
        throw err
      }
    },
  }
}
