// runtime.ts — which Meta account the CTWA section talks to, decided per request:
//   1. the account the customer connected through Facebook's popup (stored, encrypted)      → live
//   2. else credentials in the server environment (the older, manual way)                    → live
//   3. else editable sample data                                                             → sample
// It also serves the connect endpoints (/connect…), then hands every other request to handleCtwaRequest.
import { decryptKey, encryptKey } from '../ai/aiAssistant.js'
import { autoSelect, cleanHints, createConnector, publicView, type ConnectionStore, type MetaApp, type StoredConnection } from './connect.js'
import { createCtwa, type CtwaEnv } from './factory.js'
import { handleCtwaRequest, type CtwaDeps, type CtwaRequest } from './service.js'
import { createSampleStore } from './sample.js'
import { CtwaError, type CtwaStore } from './types.js'

export interface RuntimeConfig {
  env: CtwaEnv
  app: MetaApp | null
  /** encrypts the stored token (AES-256-GCM) */
  secret: string | undefined
  connections: ConnectionStore
  /** where ad referrals live (Postgres); an empty in-memory store when null (dev server) */
  liveStore: CtwaStore | null
  allow: (ip: string) => boolean
  fetchImpl?: typeof fetch
}

export type RuntimeRequest = CtwaRequest & { workspace: string; ip: string }

export function createRuntime(cfg: RuntimeConfig) {
  const sample = createCtwa({ version: cfg.env.version }, null)
  const memStore = createSampleStore(Date.now, false)
  const store = cfg.liveStore ?? memStore
  const cache = new Map<string, CtwaDeps>()           // keeps each live account's caches (currency, dataset id) between requests
  const f = cfg.fetchImpl
  const envLive = !!(cfg.env.adAccountId && cfg.env.pageId && (cfg.env.adsToken || cfg.env.waToken))

  const cached = (key: string, make: () => CtwaDeps) => { let d = cache.get(key); if (!d) { d = make(); if (cache.size > 50) cache.clear(); cache.set(key, d) } return d }

  async function resolve(ws: string): Promise<{ deps: CtwaDeps; stored: StoredConnection | null; source: 'facebook' | 'env' | null }> {
    const stored = await cfg.connections.load(ws)
    const sel = stored?.selected
    if (stored && cfg.secret && sel?.adAccountId && sel.pageId) {
      const token = decryptKey(stored.tokenEnc, cfg.secret)
      const key = `fb:${ws}:${sel.adAccountId}:${sel.pageId}:${sel.wabaId}:${stored.datasetId}:${token.slice(-12)}`
      return {
        stored, source: 'facebook',
        deps: cached(key, () => createCtwa({ ...cfg.env, adAccountId: sel.adAccountId!, pageId: sel.pageId!, adsToken: token, waToken: token, wabaId: sel.wabaId ?? cfg.env.wabaId, datasetId: stored.datasetId ?? cfg.env.datasetId }, store, f)),
      }
    }
    if (envLive) return { stored, source: 'env', deps: cached('env', () => createCtwa(cfg.env, store, f)) }
    return { stored, source: null, deps: sample }
  }

  async function connect(r: RuntimeRequest): Promise<{ status: number; body: unknown }> {
    const sub = r.path.replace(/^\/+|\/+$/g, '').split('/').slice(1)       // after "connect"
    const { stored, source } = await resolve(r.workspace)
    const view = () => resolve(r.workspace).then((x) => publicView(x.stored, cfg.app, x.source))

    if (r.method === 'GET' && !sub.length) return { status: 200, body: publicView(stored, cfg.app, source) }

    if (r.method === 'POST' && !sub.length) {
      if (!cfg.app) throw new CtwaError('Facebook login is not set up on this server yet. The operator needs to set META_APP_ID, META_APP_SECRET and META_LOGIN_CONFIG_ID.', 503, 'login_not_configured')
      if (!cfg.secret) throw new CtwaError('The server has no CONNECTIONS_SECRET (or AI_SETTINGS_SECRET) set, so it cannot store the connection safely.', 500, 'no_secret')
      if (!cfg.allow(r.ip)) throw new CtwaError('Too many connection attempts. Wait a minute and try again.', 429, 'rate_limited')
      const code = typeof r.body.code === 'string' ? r.body.code.trim() : ''
      if (code.length < 10 || code.length > 4000 || /\s/.test(code)) throw new CtwaError('Facebook did not send a login code. Please try again.', 400, 'invalid_request')
      const c = createConnector(cfg.app, f)
      const { token, businessId } = await c.exchange(code)
      const found = await c.discover(token, cleanHints(r.body.session))
      if (!found.adAccounts.length && !found.pages.length) {
        await c.revoke(token)
        throw new CtwaError('No ad account or Page was shared. In the Facebook popup, choose the ad account and the Page that is linked to your WhatsApp number, then continue.', 422, 'nothing_shared')
      }
      const next: StoredConnection = { tokenEnc: encryptKey(token, cfg.secret), userName: found.userName, businessId: businessId ?? cleanHints(r.body.session).businessId, adAccounts: found.adAccounts, pages: found.pages, wabas: found.wabas, datasetId: found.datasetId, selected: autoSelect(found, stored?.selected), connectedAt: new Date().toISOString() }
      await cfg.connections.save(r.workspace, next)
      return { status: 200, body: await view() }
    }

    if (r.method === 'POST' && sub[0] === 'select') {
      if (!stored) throw new CtwaError('Connect your Facebook account first.', 409, 'not_connected')
      const pick = (v: unknown, list: { id: string }[], label: string) => {
        if (v === undefined) return undefined
        if (v === null || v === '') return null
        if (typeof v === 'string' && list.some((a) => a.id === v)) return v
        throw new CtwaError(`That ${label} is not one of the accounts you shared.`, 400, 'invalid_request')
      }
      const a = pick(r.body.adAccountId, stored.adAccounts, 'ad account'), p = pick(r.body.pageId, stored.pages, 'Page'), w = pick(r.body.wabaId, stored.wabas, 'WhatsApp account')
      await cfg.connections.save(r.workspace, { ...stored, selected: { adAccountId: a === undefined ? stored.selected.adAccountId : a, pageId: p === undefined ? stored.selected.pageId : p, wabaId: w === undefined ? stored.selected.wabaId : w } })
      return { status: 200, body: await view() }
    }

    if (r.method === 'DELETE' && !sub.length) {
      if (!stored) {
        if (source === 'env') throw new CtwaError('This account is connected in the server settings, not through Facebook. Remove it there to disconnect.', 409, 'env_connection')
        return { status: 200, body: publicView(null, cfg.app, null) }
      }
      if (cfg.app && cfg.secret) await createConnector(cfg.app, f).revoke(decryptKey(stored.tokenEnc, cfg.secret))
      await cfg.connections.remove(r.workspace)
      return { status: 200, body: await view() }
    }

    return { status: 404, body: { error: 'not_found', message: 'Unknown CTWA endpoint.' } }
  }

  return {
    async handle(r: RuntimeRequest): Promise<{ status: number; body: unknown }> {
      try {
        if (/^\/?connect(\/|$)/.test(r.path)) return await connect(r)
        return await handleCtwaRequest(r, (await resolve(r.workspace)).deps)
      } catch (err) {
        if (err instanceof CtwaError) return { status: err.status, body: { error: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } }
        throw err
      }
    },
  }
}
