/* What a CTWA export contains. Every file carries the ad's name AND id, ISO timestamps (UTC, so they sort and parse
   anywhere) next to a readable local time, the currency, and the cost per conversation, so a spreadsheet can be
   filtered, joined to Meta's own reports, or pivoted without opening the dashboard again.
   Each function returns { columns: [{ key, label }], rows: [{ id, <key>: value }] } for ExportMenu. */

const pad = (n) => String(n).padStart(2, '0')
const iso = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d.toISOString() : '' }
const local = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : '' }
const r2 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '' : Math.round(n * 100) / 100)
const ratio = (a, b) => (b > 0 ? r2(a / b) : '')
const unix = (s) => iso(s * 1000)

const make = (cols, rows) => ({ columns: cols.map(([key, label]) => ({ key, label })), rows })

const OK = (e) => e.status !== 'failed'
const firstEvent = (lead, name) => lead.events.filter((e) => e.eventName === name && OK(e)).sort((a, b) => a.at.localeCompare(b.at))[0]

/** One row per ad for the selected period. */
export function adsExportTable({ ads, leadStats = {}, currency, range, exportedAt = new Date() }) {
  const cols = [
    ['adName', 'Ad name'], ['adId', 'Ad ID'], ['campaignName', 'Campaign name'], ['campaignId', 'Campaign ID'], ['adsetId', 'Ad set ID'], ['objective', 'Objective'],
    ['status', 'Status'], ['delivery', 'Delivery status'], ['budget', 'Daily budget'], ['currency', 'Currency'],
    ['createdUtc', 'Created (UTC)'], ['createdLocal', 'Created (local time)'], ['from', 'Report from (UTC)'], ['to', 'Report to (UTC)'],
    ['spend', 'Amount spent'], ['impressions', 'Impressions'], ['reach', 'Reach'], ['clicks', 'Link clicks'], ['ctr', 'CTR %'], ['cpc', 'Cost per click'],
    ['conversations', 'Conversations started'], ['costPerConversation', 'Cost per conversation'],
    ['leads', 'Leads captured'], ['costPerLead', 'Cost per lead'], ['qualified', 'Qualified leads'], ['purchases', 'Purchases'], ['sales', 'Sales'], ['roas', 'Return on ad spend'],
    ['headline', 'Headline'], ['primaryText', 'Primary text'], ['exportedUtc', 'Exported at (UTC)'],
  ]
  const rows = ads.map((a) => {
    const s = leadStats[a.id] ?? { leads: 0, qualified: 0, purchases: 0, revenue: 0 }
    const m = a.metrics
    return {
      id: a.id, adName: a.name, adId: a.id, campaignName: a.campaignName, campaignId: a.campaignId, adsetId: a.adsetId, objective: a.objective,
      status: a.status, delivery: a.effectiveStatus, budget: a.dailyBudget ?? '', currency,
      createdUtc: iso(a.createdAt), createdLocal: local(a.createdAt), from: unix(range.start), to: unix(range.end),
      spend: r2(m.spend), impressions: m.impressions, reach: m.reach, clicks: m.clicks, ctr: m.ctr ?? '', cpc: m.cpc ?? '',
      conversations: m.conversations, costPerConversation: m.costPerConversation ?? '',
      leads: s.leads, costPerLead: ratio(m.spend, s.leads), qualified: s.qualified, purchases: s.purchases, sales: r2(s.revenue), roas: ratio(s.revenue, m.spend),
      headline: a.headline, primaryText: a.primaryText, exportedUtc: iso(exportedAt),
    }
  })
  return make(cols, rows)
}

/** One row per lead, with its ad, key timestamps, the chat (when it is in the inbox) and what was reported to Meta.
    `findChat(lead)` returns the inbox conversation or null. */
export function leadsExportTable({ leads, ads = [], findChat = () => null, currency, exportedAt = new Date() }) {
  const byId = Object.fromEntries(ads.map((a) => [a.id, a]))
  const cols = [
    ['leadId', 'Lead ID'], ['name', 'Name'], ['whatsapp', 'WhatsApp number'], ['email', 'Email'], ['company', 'Company'],
    ['adName', 'Ad name'], ['adId', 'Ad ID'], ['campaignName', 'Campaign name'], ['headline', 'Ad headline'], ['sourceType', 'Source type'], ['sourceUrl', 'Ad link'], ['clickId', 'Click ID (ctwa_clid)'],
    ['startedUtc', 'Chat started (UTC)'], ['startedLocal', 'Chat started (local time)'],
    ['chatStatus', 'Chat status'], ['agent', 'Agent'],
    ['leadUtc', 'Lead sent to Meta (UTC)'], ['qualifiedUtc', 'Qualified sent to Meta (UTC)'], ['purchaseUtc', 'First purchase sent to Meta (UTC)'], ['events', 'Events sent to Meta'],
    ['sales', 'Sales'], ['currency', 'Currency'], ['costPerConversation', "Ad's cost per conversation"], ['exportedUtc', 'Exported at (UTC)'],
  ]
  const rows = leads.map((l) => {
    const ad = byId[l.sourceId]
    const chat = findChat(l)
    const buys = l.events.filter((e) => e.eventName === 'Purchase' && OK(e))
    return {
      id: l.id, leadId: l.id, name: l.contactName || chat?.name || '', whatsapp: `+${l.waId}`, email: chat?.email || '', company: chat?.company || '',
      adName: l.adName || ad?.name || '', adId: l.sourceId || '', campaignName: ad?.campaignName || '', headline: l.headline || ad?.headline || '', sourceType: l.sourceType || '', sourceUrl: l.sourceUrl || '', clickId: l.ctwaClid || '',
      startedUtc: iso(l.createdAt), startedLocal: local(l.createdAt),
      chatStatus: chat ? ({ bot: 'Bot', agent: 'Agent', resolved: 'Resolved' }[chat.status] || chat.status) : '', agent: chat?.agentName || '',
      leadUtc: iso(firstEvent(l, 'LeadSubmitted')?.at), qualifiedUtc: iso(firstEvent(l, 'QualifiedLead')?.at), purchaseUtc: iso(buys.sort((a, b) => a.at.localeCompare(b.at))[0]?.at),
      events: l.events.filter(OK).map((e) => e.eventName).join(', '),
      sales: r2(buys.reduce((n, e) => n + (e.value || 0), 0)) || '', currency: buys[0]?.currency || currency,
      costPerConversation: ad?.metrics.costPerConversation ?? '', exportedUtc: iso(exportedAt),
    }
  })
  return make(cols, rows)
}

/** One row per day for the whole account. */
export function dailyExportTable({ daily, currency }) {
  return make([['date', 'Date'], ['spend', 'Amount spent'], ['impressions', 'Impressions'], ['clicks', 'Link clicks'], ['ctr', 'CTR %'], ['conversations', 'Conversations started'], ['costPerConversation', 'Cost per conversation'], ['currency', 'Currency']],
    daily.map((d) => ({ id: d.date, date: d.date, spend: r2(d.spend), impressions: d.impressions, clicks: d.clicks, ctr: d.impressions > 0 ? r2((d.clicks / d.impressions) * 100) : '', conversations: d.conversations, costPerConversation: ratio(d.spend, d.conversations), currency })))
}
