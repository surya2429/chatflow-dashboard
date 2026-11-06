// types.ts — Click-to-WhatsApp (CTWA) ads: the shapes shared by the Meta Marketing API client, the sample-data
// backend, the HTTP handler and the lead store.

/** What the dashboard shows for one ad. Money is in the account's own currency, in major units (₹, not paise). */
export interface AdMetrics {
  spend: number
  impressions: number
  reach: number
  clicks: number
  /** "Messaging conversations started" — what a CTWA ad is bought for. */
  conversations: number
  ctr: number | null
  cpc: number | null
  costPerConversation: number | null
}

export type WelcomeType = 'autofill' | 'ice_breakers'

export interface AdWelcome {
  type: WelcomeType
  greeting: string
  /** autofill: the message that is pre-typed in the customer's WhatsApp box */
  autofillMessage?: string
  /** ice_breakers: up to three tappable questions */
  iceBreakers?: string[]
}

export interface CtwaAd {
  id: string
  name: string
  /** What the advertiser set: ACTIVE | PAUSED (ARCHIVED ads are not listed). */
  status: 'ACTIVE' | 'PAUSED'
  /** What Meta says it is really doing: ACTIVE, PAUSED, PENDING_REVIEW, DISAPPROVED, WITH_ISSUES, CAMPAIGN_PAUSED … */
  effectiveStatus: string
  campaignId: string
  campaignName: string
  objective: string
  adsetId: string
  dailyBudget: number | null
  headline: string
  primaryText: string
  imageUrl: string | null
  createdAt: string
  metrics: AdMetrics
}

export interface DailyPoint { date: string; spend: number; impressions: number; clicks: number; conversations: number }

export interface Dashboard {
  mode: 'live' | 'sample'
  currency: string
  range: { start: number; end: number }
  totals: AdMetrics
  daily: DailyPoint[]
  ads: CtwaAd[]
  leadStats: Record<string, LeadStats>
}

export const OBJECTIVES = ['OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_TRAFFIC'] as const
export type Objective = (typeof OBJECTIVES)[number]

export interface CreateAdInput {
  name: string
  objective: Objective
  /** major units of the account currency */
  dailyBudget: number
  startTime: string | null
  endTime: string | null
  targeting: { countries: string[]; ageMin: number; ageMax: number; genders: 'all' | 'male' | 'female' }
  creative: {
    primaryText: string
    headline: string
    description: string
    imageUrl: string | null
    /** base64 (no data: prefix) of an uploaded image; sent to Meta's /adimages */
    imageBase64: string | null
    welcome: AdWelcome
  }
  /** new ads start PAUSED so nothing spends until the owner turns them on */
  status: 'ACTIVE' | 'PAUSED'
}

export interface CreatedAd { campaignId: string; adsetId: string; creativeId: string; adId: string }

export interface AdPatch { status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'; name?: string; dailyBudget?: number }

export interface SetupInfo {
  mode: 'live' | 'sample'
  account: { name: string; currency: string; id: string } | null
  page: { id: string; name: string } | null
  whatsappNumber: string | null
  datasetId: string | null
  checks: { key: string; label: string; ok: boolean; hint: string }[]
}

/** Both the real Meta client and the sample backend implement this; the HTTP handler only knows this. */
export interface AdsBackend {
  mode: 'live' | 'sample'
  currency(): Promise<string>
  dashboard(range: { start: number; end: number }): Promise<Omit<Dashboard, 'mode' | 'currency' | 'range' | 'leadStats'>>
  createAd(input: CreateAdInput): Promise<CreatedAd>
  updateAd(adId: string, patch: AdPatch): Promise<void>
  setup(): Promise<SetupInfo>
}

export class CtwaError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'ctwa_error', readonly fields?: Record<string, string>) {
    super(message)
  }
}

/* ── leads (the ad that started a chat) and the events sent back to Meta ── */
export interface Referral {
  waId: string
  contactName: string | null
  ctwaClid: string | null
  sourceId: string | null
  sourceType: string | null
  sourceUrl: string | null
  headline: string | null
  body: string | null
  mediaType: string | null
  mediaUrl: string | null
  welcomeText: string | null
  waMessageId: string
  phoneNumberId: string | null
  createdAt: string
}

export interface LeadEvent { eventName: string; value: number | null; currency: string | null; status: 'sent' | 'failed' | 'simulated'; error: string | null; at: string }
export interface Lead extends Referral { id: string; adName: string | null; events: LeadEvent[] }

/** What one ad brought in, for the Ads table and the ad's own page. Revenue is the sum of the Purchase events reported for its leads. */
export interface LeadStats { leads: number; qualified: number; purchases: number; revenue: number }

export interface CtwaStore {
  /** false when this message was already recorded (Meta redelivers webhooks) */
  saveReferral(r: Referral): Promise<boolean>
  /** newest first; `sourceId` narrows it to the leads of one ad */
  listLeads(limit: number, sourceId?: string): Promise<Lead[]>
  /** per ad id, for referrals created inside the range (unix seconds) */
  statsBySource(range: { start: number; end: number }): Promise<Record<string, LeadStats>>
  /** the newest ad referral for a WhatsApp number, if the chat came from an ad */
  latestForWaId(waId: string): Promise<Lead | null>
  logEvent(waId: string, ctwaClid: string | null, e: LeadEvent): Promise<void>
}

/** Standard events Meta accepts for business messaging (Conversions API). */
export const CAPI_EVENTS = ['LeadSubmitted', 'QualifiedLead', 'Purchase', 'InitiateCheckout', 'AddToCart', 'ViewContent', 'OrderCreated', 'OrderShipped', 'OrderDelivered', 'OrderCanceled', 'OrderReturned', 'CartAbandoned', 'RatingProvided', 'ReviewProvided'] as const
export type CapiEvent = (typeof CAPI_EVENTS)[number]
