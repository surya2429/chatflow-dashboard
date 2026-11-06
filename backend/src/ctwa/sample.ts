// sample.ts — what the CTWA section shows until a Meta ad account is connected: a believable set of ads whose
// numbers are generated per day (so totals, the daily chart and every date range agree with each other), and
// leads for the sample conversations. Everything is editable in memory — create, pause, change the budget —
// so the whole section can be tried before any real ad exists. Nothing here ever talks to Meta.
import {
  CtwaError, type AdPatch, type AdsBackend, type CreateAdInput, type CreatedAd, type CtwaAd, type CtwaStore, type DailyPoint, type Lead, type LeadEvent, type Referral,
} from './types.js'
import { day, emptyMetrics, finishMetrics, sumMetrics } from './common.js'

const DAY = 86400_000

/** small deterministic generator: the same ad and day always give the same numbers */
function rand(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

interface Run { from: number; to: number | null }                    // ms; to = null while running
interface SampleAd extends Omit<CtwaAd, 'metrics' | 'status' | 'effectiveStatus'> {
  runs: Run[]
  /** daily impressions, click-through %, conversations per click, cost per 1000 impressions */
  profile: { impressions: number; ctr: number; convRate: number; cpm: number }
  archived: boolean
}

const SEED: { name: string; campaign: string; objective: string; budget: number; ago: number; paused: boolean; headline: string; text: string; profile: SampleAd['profile'] }[] = [
  { name: 'Summer Flash Sale — carousel', campaign: 'Summer Sale 2026', objective: 'OUTCOME_ENGAGEMENT', budget: 1500, ago: 58, paused: false, headline: 'Flat 30% off this weekend', text: 'Chat with us on WhatsApp to grab the Summer Flash Sale before it ends. Tap “Send message”.', profile: { impressions: 14200, ctr: 2.4, convRate: 0.21, cpm: 96 } },
  { name: 'Summer Flash Sale — video', campaign: 'Summer Sale 2026', objective: 'OUTCOME_ENGAGEMENT', budget: 1000, ago: 58, paused: false, headline: 'See it in action, then ask us anything', text: 'Watch the 20-second demo, then message us on WhatsApp for a personal quote.', profile: { impressions: 9800, ctr: 1.9, convRate: 0.17, cpm: 88 } },
  { name: 'Free Demo Booking', campaign: 'Lead Generation', objective: 'OUTCOME_LEADS', budget: 2000, ago: 41, paused: false, headline: 'Book a free 15-min demo', text: 'Tell us your business on WhatsApp and we will set up a demo the same day.', profile: { impressions: 18600, ctr: 2.8, convRate: 0.26, cpm: 112 } },
  { name: 'Diwali Offer — Reels', campaign: 'Festive 2026', objective: 'OUTCOME_SALES', budget: 2500, ago: 27, paused: false, headline: 'Diwali offers are live', text: 'Message us “DIWALI” on WhatsApp for early-bird prices and free delivery.', profile: { impressions: 24100, ctr: 3.1, convRate: 0.19, cpm: 134 } },
  { name: 'Retargeting — cart visitors', campaign: 'Lead Generation', objective: 'OUTCOME_LEADS', budget: 600, ago: 19, paused: false, headline: 'Still thinking it over?', text: 'Have a question about your cart? Chat to us on WhatsApp and we will help right away.', profile: { impressions: 5200, ctr: 4.2, convRate: 0.33, cpm: 78 } },
  { name: 'Brand Awareness — Mumbai', campaign: 'Festive 2026', objective: 'OUTCOME_TRAFFIC', budget: 800, ago: 12, paused: true, headline: 'Mumbai’s favourite, now on WhatsApp', text: 'Say hi on WhatsApp for catalogues, prices and store timings near you.', profile: { impressions: 11800, ctr: 1.2, convRate: 0.09, cpm: 64 } },
  { name: 'New Collection Launch', campaign: 'Summer Sale 2026', objective: 'OUTCOME_ENGAGEMENT', budget: 1200, ago: 4, paused: false, headline: 'The new collection is here', text: 'Be the first to see it — message us on WhatsApp for the lookbook.', profile: { impressions: 8800, ctr: 2.2, convRate: 0.2, cpm: 101 } },
]

export function createSampleAds(now: () => number = Date.now, currency = 'INR'): AdsBackend & { ads: SampleAd[] } {
  const ads: SampleAd[] = SEED.map((s, i) => ({
    id: `sample_ad_${i + 1}`, name: s.name, campaignId: `sample_cmp_${s.campaign.replace(/\W+/g, '').toLowerCase()}`, campaignName: s.campaign,
    objective: s.objective, adsetId: `sample_set_${i + 1}`, dailyBudget: s.budget, headline: s.headline, primaryText: s.text, imageUrl: null,
    createdAt: new Date(now() - s.ago * DAY).toISOString(),
    runs: [{ from: now() - s.ago * DAY, to: s.paused ? now() - 2 * DAY : null }],
    profile: s.profile, archived: false,
  }))

  const dayMetrics = (a: SampleAd, date: string) => {
    // a day counts when the ad was running at the start of it (so a pause today costs nothing from today on)
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    if (!a.runs.some((r) => date >= iso(r.from) && (r.to === null || date < iso(r.to)))) return null
    const k = (n: string, lo: number, hi: number) => lo + rand(`${a.id}|${date}|${n}`) * (hi - lo)
    const budgetScale = (a.dailyBudget ?? 1000) / (SEED[Number(a.id.split('_')[2]) - 1]?.budget ?? a.dailyBudget ?? 1000)
    const impressions = Math.round(a.profile.impressions * k('i', 0.7, 1.3) * budgetScale)
    const clicks = Math.round((impressions * a.profile.ctr / 100) * k('c', 0.8, 1.2))
    const conversations = Math.round(clicks * a.profile.convRate * k('v', 0.7, 1.3))
    return { spend: (impressions / 1000) * a.profile.cpm * k('s', 0.92, 1.08), impressions, reach: Math.round(impressions * k('r', 0.55, 0.7)), clicks, conversations }
  }
  const days = (range: { start: number; end: number }) => { const out: string[] = []; for (let t = range.start; t <= range.end; t += 86400) out.push(day(t)); return out.slice(0, 91) }

  const view = (a: SampleAd, range: { start: number; end: number }): CtwaAd => {
    const parts = days(range).map((d) => dayMetrics(a, d)).filter((m): m is NonNullable<typeof m> => !!m)
    const m = parts.length ? finishMetrics(parts.reduce((x, y) => ({ spend: x.spend + y.spend, impressions: x.impressions + y.impressions, reach: x.reach + y.reach, clicks: x.clicks + y.clicks, conversations: x.conversations + y.conversations }))) : emptyMetrics()
    const running = a.runs[a.runs.length - 1]!.to === null
    const { runs: _r, profile: _p, archived: _a, ...rest } = a
    return { ...rest, status: running ? 'ACTIVE' : 'PAUSED', effectiveStatus: running ? 'ACTIVE' : 'PAUSED', metrics: m }
  }

  return {
    mode: 'sample',
    ads,
    currency: async () => currency,

    async dashboard(range) {
      const live = ads.filter((a) => !a.archived)
      const list = live.map((a) => view(a, range))
      const daily: DailyPoint[] = days(range).map((d) => {
        const t = live.map((a) => dayMetrics(a, d)).filter((m): m is NonNullable<typeof m> => !!m)
        return { date: d, spend: Math.round(t.reduce((n, m) => n + m.spend, 0) * 100) / 100, impressions: t.reduce((n, m) => n + m.impressions, 0), clicks: t.reduce((n, m) => n + m.clicks, 0), conversations: t.reduce((n, m) => n + m.conversations, 0) }
      })
      return { ads: list, totals: sumMetrics(list.map((a) => a.metrics)), daily }
    },

    async createAd(i: CreateAdInput): Promise<CreatedAd> {
      const n = ads.length + 1, t = now()
      const id = `sample_ad_${n}_${Math.floor(t / 1000) % 100000}`
      ads.unshift({
        id, name: i.name, campaignId: `sample_cmp_new_${n}`, campaignName: i.name, objective: i.objective, adsetId: `sample_set_${id}`, dailyBudget: i.dailyBudget,
        headline: i.creative.headline, primaryText: i.creative.primaryText,
        imageUrl: i.creative.imageUrl ?? (i.creative.imageBase64 ? `data:image/jpeg;base64,${i.creative.imageBase64}` : null),
        createdAt: new Date(t).toISOString(), runs: i.status === 'ACTIVE' ? [{ from: t, to: null }] : [{ from: t, to: t }], archived: false,
        profile: { impressions: 9000, ctr: 2.1, convRate: 0.18, cpm: 95 },
      })
      return { campaignId: `sample_cmp_new_${n}`, adsetId: `sample_set_${id}`, creativeId: `sample_cr_${id}`, adId: id }
    },

    async updateAd(adId, p: AdPatch) {
      const a = ads.find((x) => x.id === adId && !x.archived)
      if (!a) throw new CtwaError('That ad was not found.', 404, 'not_found')
      if (p.name !== undefined) a.name = p.name
      if (p.dailyBudget !== undefined) a.dailyBudget = p.dailyBudget
      const last = a.runs[a.runs.length - 1]!
      if (p.status === 'PAUSED' && last.to === null) last.to = now()
      if (p.status === 'ACTIVE' && last.to !== null) a.runs.push({ from: now(), to: null })
      if (p.status === 'ARCHIVED') { a.archived = true; if (last.to === null) last.to = now() }
    },

    async setup() {
      return {
        mode: 'sample' as const, account: { id: 'act_sample', name: 'Sample ad account', currency }, page: { id: 'sample_page', name: 'Sample business Page' },
        whatsappNumber: null, datasetId: null,
        checks: [
          { key: 'account', label: 'Ad account reachable', ok: false, hint: 'Set META_AD_ACCOUNT_ID and a token with ads_management + ads_read.' },
          { key: 'page', label: 'Facebook Page reachable', ok: false, hint: 'Set META_PAGE_ID — the Page linked to your WhatsApp number.' },
          { key: 'dataset', label: 'Conversions dataset', ok: false, hint: 'Set WA_BUSINESS_ACCOUNT_ID; the dataset is created on first use.' },
        ],
      }
    },
  }
}

/* ── sample leads: the people those ads sent to WhatsApp ───────────────────────────────────────────────────── */
const PEOPLE: [string, string, number, number][] = [
  // name, wa number, ad index (1-based), days ago
  ['Priya Sharma', '919876543210', 1, 0], ['Rahul Mehta', '918234109876', 3, 0], ['Anita Desai', '919812345670', 4, 1], ['Karan Malhotra', '919900112233', 4, 1],
  ['Sneha Iyer', '919845671234', 3, 2], ['Mohit Verma', '918899776655', 1, 3], ['Divya Nair', '919447123456', 7, 3], ['Arjun Reddy', '919100223344', 2, 4],
  ['Pooja Gupta', '919811223344', 5, 5], ['Imran Khan', '919322110099', 4, 6], ['Neha Kapoor', '919876001122', 1, 8], ['Rohit Jain', '919555667788', 3, 9],
  ['Tanvi Shah', '919999888777', 2, 12], ['Sameer Joshi', '919123456780', 6, 15],
]

/** `seed: false` = an empty in-memory store (the dev server uses it with real Meta credentials, where fake leads would mislead). */
export function createSampleStore(now: () => number = Date.now, seed = true): CtwaStore & { names: Map<string, string> } {
  const names = new Map(SEED.map((s, i) => [`sample_ad_${i + 1}`, s.name]))
  const leads: Lead[] = (seed ? PEOPLE : []).map(([name, waId, ad, ago], i) => {
    const s = SEED[ad - 1]!
    return {
      id: `sample_lead_${i + 1}`, waId, contactName: name, ctwaClid: `sample_clid_${i + 1}_${waId.slice(-4)}`, sourceId: `sample_ad_${ad}`, sourceType: 'ad',
      sourceUrl: `https://fb.me/sample${ad}`, headline: s.headline, body: s.text, mediaType: 'image', mediaUrl: null, welcomeText: null,
      waMessageId: `sample_wamid_${i + 1}`, phoneNumberId: null, createdAt: new Date(now() - ago * DAY - (i % 7) * 3600_000).toISOString(), adName: s.name, events: [],
    }
  })
  return {
    names,
    async saveReferral(r: Referral) {
      if (leads.some((l) => l.waMessageId === r.waMessageId)) return false
      leads.unshift({ ...r, id: `sample_lead_new_${leads.length + 1}`, adName: r.sourceId ? names.get(r.sourceId) ?? null : null, events: [] })
      return true
    },
    async listLeads(limit) { return [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit) },
    async latestForWaId(waId) { return [...leads].filter((l) => l.waId === waId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null },
    async logEvent(waId, clid, e: LeadEvent) {
      const l = leads.find((x) => x.waId === waId && (clid === null || x.ctwaClid === clid))
      if (l) l.events.push(e)
    },
  }
}
