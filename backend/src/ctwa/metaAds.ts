// metaAds.ts — the live backend: Click-to-WhatsApp ads through Meta's Marketing API.
//
//   create   POST act_{id}/campaigns → adsets → (adimages) → adcreatives → ads        (docs: Marketing API → Ads that Click to WhatsApp)
//   list     GET  act_{id}/ads + act_{id}/insights (level=ad, and daily)
//   manage   POST /{ad|adset|campaign} { status | name | daily_budget }
//
// Pure: no env, no DB. Callers pass the account, page and token; the token is sent as a Bearer header, never in a URL.
import {
  CtwaError, type AdPatch, type AdsBackend, type AdWelcome, type CreateAdInput, type CreatedAd, type CtwaAd, type DailyPoint, type SetupInfo,
} from './types.js'
import { day, finishMetrics, fromMinor, sumMetrics, toMinor } from './common.js'

export interface MetaAdsConfig {
  adAccountId: string      // digits, with or without "act_"
  pageId: string
  accessToken: string
  version: string          // e.g. "v20.0"
  /** optional: pin the WhatsApp number the ads open; Meta otherwise uses the one linked to the Page. Immutable on an ad set. */
  whatsappNumber?: string | undefined
  wabaId?: string | undefined
  datasetId?: string | undefined
  fetchImpl?: typeof fetch
}

/** "Messaging conversations started" is reported under one of these action types, depending on the account. */
const CONVERSATION_ACTIONS = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.total_messaging_connection']
// everything except ARCHIVED / DELETED
const LIVE_STATUSES = ['ACTIVE', 'PAUSED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES']

export const welcomePayload = (w: AdWelcome) => ({
  type: 'VISUAL_EDITOR', version: 2, landing_screen_type: 'welcome_message', media_type: 'text',
  text_format: w.type === 'autofill'
    ? { customer_action_type: 'autofill_message', message: { autofill_message: { content: w.autofillMessage ?? '' }, text: w.greeting } }
    : { customer_action_type: 'ice_breakers', message: { text: w.greeting, ice_breakers: (w.iceBreakers ?? []).map((title) => ({ title })) } },
})

export function buildAdsetBody(i: CreateAdInput, cfg: MetaAdsConfig, campaignId: string, currency: string) {
  return {
    name: `${i.name} · ad set`,
    campaign_id: campaignId,
    daily_budget: String(toMinor(i.dailyBudget, currency)),
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    destination_type: 'WHATSAPP',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { page_id: cfg.pageId, ...(cfg.whatsappNumber ? { whatsapp_phone_number: cfg.whatsappNumber } : {}) },
    targeting: {
      geo_locations: { countries: i.targeting.countries },
      age_min: i.targeting.ageMin, age_max: i.targeting.ageMax,
      ...(i.targeting.genders === 'all' ? {} : { genders: [i.targeting.genders === 'male' ? 1 : 2] }),
    },
    ...(i.startTime ? { start_time: i.startTime } : {}),
    ...(i.endTime ? { end_time: i.endTime } : {}),
    status: 'PAUSED',
  }
}

export function buildCreativeBody(i: CreateAdInput, cfg: MetaAdsConfig, imageHash: string | null) {
  const c = i.creative
  return {
    name: `${i.name} · creative`,
    object_story_spec: {
      page_id: cfg.pageId,
      link_data: {
        name: c.headline,
        message: c.primaryText,
        ...(c.description ? { description: c.description } : {}),
        ...(imageHash ? { image_hash: imageHash } : { picture: c.imageUrl }),
        link: 'https://api.whatsapp.com/send',
        call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } },
        page_welcome_message: welcomePayload(c.welcome),
      },
    },
  }
}

export function createMetaAds(cfg: MetaAdsConfig): AdsBackend {
  const f = cfg.fetchImpl ?? fetch
  const act = `act_${cfg.adAccountId.replace(/^act_/, '')}`
  let currencyCache: string | undefined

  async function call<T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    const url = new URL(`https://graph.facebook.com/${cfg.version}/${path}`)
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
    let res: Response
    try {
      res = await f(url.toString(), {
        method,
        headers: { Authorization: `Bearer ${cfg.accessToken}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
        ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      throw new CtwaError('Could not reach Meta. Check the connection and try again.', 502, 'meta_unreachable')
    }
    const json = (await res.json().catch(() => ({}))) as any
    if (!res.ok || json.error) {
      const e = json.error ?? {}
      const msg = String(e.error_user_msg || e.message || `Meta returned ${res.status}`)
      if (e.code === 190) throw new CtwaError('Meta rejected the access token. It may have expired — generate a new one.', 401, 'meta_token')
      if (e.code === 200 || e.code === 10 || e.code === 294) throw new CtwaError(`Meta says this token lacks permission (${msg}). It needs ads_management and ads_read.`, 403, 'meta_permission')
      throw new CtwaError(msg, res.status === 400 ? 400 : 502, "meta_error")
    }
    return json as T
  }

  /** every row of a paged edge (cursor paging; the "next" URL is not followed because it may carry a token) */
  async function all(path: string, query: Record<string, string>, maxPages = 10): Promise<any[]> {
    const rows: any[] = []
    let after: string | undefined
    for (let p = 0; p < maxPages; p++) {
      const page = await call<any>('GET', path, { query: { limit: '100', ...query, ...(after ? { after } : {}) } })
      rows.push(...(page.data ?? []))
      after = page.paging?.cursors?.after
      if (!page.paging?.next || !after) break
    }
    return rows
  }

  const currency = async () => (currencyCache ??= (await call<{ currency?: string }>('GET', act, { query: { fields: 'currency' } })).currency ?? 'USD')

  const conversationsOf = (actions: any[] | undefined) => {
    for (const t of CONVERSATION_ACTIONS) { const a = (actions ?? []).find((x) => x.action_type === t); if (a) return Number(a.value) || 0 }
    return 0
  }
  const metricsOf = (row: any) => finishMetrics({ spend: Number(row?.spend) || 0, impressions: Number(row?.impressions) || 0, reach: Number(row?.reach) || 0, clicks: Number(row?.clicks) || 0, conversations: conversationsOf(row?.actions) })

  return {
    mode: 'live',
    currency,

    async dashboard(range) {
      const cur = await currency()
      const time_range = JSON.stringify({ since: range.since ?? day(range.start), until: range.until ?? day(range.end) })
      const fields = 'spend,impressions,reach,clicks,actions'
      const [adRows, insights, dailyRows] = await Promise.all([
        all(`${act}/ads`, {
          fields: 'id,name,status,effective_status,created_time,adset{id,daily_budget,destination_type},campaign{id,name,objective},creative{thumbnail_url,image_url,object_story_spec}',
          effective_status: JSON.stringify(LIVE_STATUSES),
        }),
        all(`${act}/insights`, { level: 'ad', fields: `ad_id,${fields}`, time_range }),
        all(`${act}/insights`, { level: 'account', fields: `${fields}`, time_range, time_increment: '1' }),
      ])
      const byAd = new Map(insights.map((r) => [String(r.ad_id), metricsOf(r)]))
      const ads: CtwaAd[] = adRows
        .filter((a) => a.adset?.destination_type === 'WHATSAPP')          // only Click-to-WhatsApp ads
        .map((a) => {
          const ld = a.creative?.object_story_spec?.link_data ?? {}
          return {
            id: String(a.id), name: String(a.name ?? ''),
            status: a.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED', effectiveStatus: String(a.effective_status ?? a.status ?? ''),
            campaignId: String(a.campaign?.id ?? ''), campaignName: String(a.campaign?.name ?? ''), objective: String(a.campaign?.objective ?? ''),
            adsetId: String(a.adset?.id ?? ''), dailyBudget: fromMinor(a.adset?.daily_budget, cur),
            headline: String(ld.name ?? ''), primaryText: String(ld.message ?? ''),
            imageUrl: a.creative?.image_url || a.creative?.thumbnail_url || null,
            createdAt: String(a.created_time ?? ''),
            metrics: byAd.get(String(a.id)) ?? finishMetrics({ spend: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 }),
          }
        })
      const daily: DailyPoint[] = dailyRows.map((r) => ({ date: String(r.date_start), spend: Number(r.spend) || 0, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0, conversations: conversationsOf(r.actions) }))
      // account-level insights also count non-CTWA ads; the headline totals are the sum of the CTWA ads shown
      return { ads, totals: sumMetrics(ads.map((a) => a.metrics)), daily }
    },

    async createAd(i): Promise<CreatedAd> {
      const cur = await currency()
      const made: string[] = []                                    // ids to remove again if a later step fails
      let step = 'campaign'
      try {
        const campaign = await call<{ id: string }>('POST', `${act}/campaigns`, { body: { name: i.name, objective: i.objective, status: 'PAUSED', special_ad_categories: [] } })
        made.push(campaign.id)
        step = 'ad set'
        const adset = await call<{ id: string }>('POST', `${act}/adsets`, { body: buildAdsetBody(i, cfg, campaign.id, cur) })
        made.push(adset.id)
        let hash: string | null = null
        if (i.creative.imageBase64) {
          step = 'image upload'
          const up = await call<{ images?: Record<string, { hash: string }> }>('POST', `${act}/adimages`, { body: { bytes: i.creative.imageBase64 } })
          hash = Object.values(up.images ?? {})[0]?.hash ?? null
          if (!hash) throw new CtwaError('Meta did not accept the image.', 400, 'meta_image')
        }
        step = 'creative'
        const creative = await call<{ id: string }>('POST', `${act}/adcreatives`, { body: buildCreativeBody(i, cfg, hash) })
        made.push(creative.id)
        step = 'ad'
        const ad = await call<{ id: string }>('POST', `${act}/ads`, { body: { name: i.name, adset_id: adset.id, creative: { creative_id: creative.id }, status: 'PAUSED' } })
        made.push(ad.id)
        if (i.status === 'ACTIVE') {
          step = 'publish'
          for (const id of [campaign.id, adset.id, ad.id]) await call('POST', id, { body: { status: 'ACTIVE' } })
        }
        return { campaignId: campaign.id, adsetId: adset.id, creativeId: creative.id, adId: ad.id }
      } catch (err) {
        for (const id of made.reverse()) await call('DELETE', id).catch(() => undefined)     // best effort: do not leave half an ad behind
        if (err instanceof CtwaError) throw new CtwaError(`Meta could not create the ${step}: ${err.message}`, err.status, err.code)
        throw err
      }
    },

    async updateAd(adId, p: AdPatch) {
      if (p.name !== undefined) await call('POST', adId, { body: { name: p.name } })
      if (p.dailyBudget !== undefined) {
        const { adset_id } = await call<{ adset_id: string }>('GET', adId, { query: { fields: 'adset_id' } })
        await call('POST', adset_id, { body: { daily_budget: String(toMinor(p.dailyBudget, await currency())) } })
      }
      if (p.status === 'ACTIVE') {
        // ads made here start PAUSED all the way up, so turning one on means turning its ad set and campaign on too
        const { adset_id, campaign_id } = await call<{ adset_id: string; campaign_id: string }>('GET', adId, { query: { fields: 'adset_id,campaign_id' } })
        for (const id of [campaign_id, adset_id, adId]) await call('POST', id, { body: { status: 'ACTIVE' } })
      } else if (p.status) {
        await call('POST', adId, { body: { status: p.status } })
      }
    },

    async setup(): Promise<SetupInfo> {
      const checks: SetupInfo['checks'] = []
      const probe = async <T>(key: string, label: string, hint: string, fn: () => Promise<T>): Promise<T | null> => {
        try { const v = await fn(); checks.push({ key, label, ok: true, hint: '' }); return v } catch (e) { checks.push({ key, label, ok: false, hint: e instanceof Error ? e.message : hint }); return null }
      }
      const acc = await probe('account', 'Ad account reachable', 'Check META_AD_ACCOUNT_ID and the token permissions.', () => call<{ name?: string; currency?: string }>('GET', act, { query: { fields: 'name,currency' } }))
      const page = await probe('page', 'Facebook Page reachable', 'Check META_PAGE_ID — it must be the Page linked to your WhatsApp number.', () => call<{ name?: string }>('GET', cfg.pageId, { query: { fields: 'name' } }))
      let datasetId = cfg.datasetId ?? null
      if (cfg.wabaId && !datasetId) {
        datasetId = await probe('dataset', 'Conversions dataset', 'Needs whatsapp_business_manage_events. It is created on first use.', async () => (await call<any>('GET', `${cfg.wabaId}/dataset`)).data?.[0]?.id ?? null)
      } else checks.push({ key: 'dataset', label: 'Conversions dataset', ok: !!datasetId || !!cfg.wabaId, hint: cfg.wabaId ? '' : 'Set WA_BUSINESS_ACCOUNT_ID to send conversion events.' })
      return {
        mode: 'live',
        account: acc ? { id: act, name: acc.name ?? act, currency: acc.currency ?? 'USD' } : null,
        page: page ? { id: cfg.pageId, name: page.name ?? cfg.pageId } : null,
        whatsappNumber: cfg.whatsappNumber ?? null,
        datasetId,
        checks,
      }
    },
  }
}
