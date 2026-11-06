// factory.ts — decides live or sample. With an ad account, Page and token the section talks to Meta (ads, insights,
// Conversions API) and reads real leads from `liveStore`; without them it runs on sample data that can be edited in
// memory, and events are only simulated — fake leads are never sent to Meta.
import { createCapi } from './capi.js'
import { createMetaAds } from './metaAds.js'
import { createSampleAds, createSampleStore } from './sample.js'
import type { CtwaDeps } from './service.js'
import type { CtwaStore } from './types.js'

export interface CtwaEnv {
  adAccountId?: string | undefined
  pageId?: string | undefined
  /** token with ads_management + ads_read (falls back to the WhatsApp token if that one has been granted ads access) */
  adsToken?: string | undefined
  /** token with whatsapp_business_manage_events, for the Conversions API */
  waToken?: string | undefined
  version: string
  whatsappNumber?: string | undefined
  wabaId?: string | undefined
  datasetId?: string | undefined
  partnerAgent?: string | undefined
}

export function createCtwa(env: CtwaEnv, liveStore: CtwaStore | null, fetchImpl?: typeof fetch): CtwaDeps {
  const token = env.adsToken || env.waToken
  if (env.adAccountId && env.pageId && token && liveStore) {
    const capiToken = env.waToken || token
    return {
      ads: createMetaAds({ adAccountId: env.adAccountId, pageId: env.pageId, accessToken: token, version: env.version, whatsappNumber: env.whatsappNumber, wabaId: env.wabaId, datasetId: env.datasetId, ...(fetchImpl ? { fetchImpl } : {}) }),
      store: liveStore,
      capi: env.wabaId ? createCapi({ wabaId: env.wabaId, accessToken: capiToken, version: env.version, datasetId: env.datasetId, partnerAgent: env.partnerAgent, ...(fetchImpl ? { fetchImpl } : {}) }) : null,
    }
  }
  return { ads: createSampleAds(), store: createSampleStore(), capi: null }
}
