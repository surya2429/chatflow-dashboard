// Run: node backend/scripts/ctwaExports.check.mjs  (from the repo root)
import assert from 'node:assert/strict'
import { adsExportTable, dailyExportTable, leadsExportTable } from '../../src/components/ctwa/exports.js'
import { toCsv } from '../../src/components/ai/aiTable.js'

const ads = [{
  id: '1202', name: 'Summer Sale — carousel', campaignId: 'C9', campaignName: 'Summer 2026', adsetId: 'S4', objective: 'OUTCOME_ENGAGEMENT', status: 'ACTIVE', effectiveStatus: 'ACTIVE',
  dailyBudget: 1500, createdAt: '2026-09-10T08:30:00Z', headline: 'Flat 30% off', primaryText: '=Chat with us, "now"',
  metrics: { spend: 1000, impressions: 50000, reach: 30000, clicks: 1200, conversations: 250, ctr: 2.4, cpc: 0.83, costPerConversation: 4 },
}, { id: '1203', name: 'No traffic yet', campaignId: 'C9', campaignName: 'Summer 2026', adsetId: 'S5', objective: 'OUTCOME_LEADS', status: 'PAUSED', effectiveStatus: 'PAUSED', dailyBudget: null, createdAt: '2026-11-01T00:00:00Z', headline: '', primaryText: '', metrics: { spend: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0, ctr: null, cpc: null, costPerConversation: null } }]
const range = { start: 1_762_300_800, end: 1_764_892_800 }                                          // 2025-11-05 → 2025-12-05
const exportedAt = new Date('2026-11-06T09:00:00Z')

/* ── ads: the ad's name AND id, ISO timestamps, currency, cost per conversation, and the lead numbers ── */
const a = adsExportTable({ ads, leadStats: { 1202: { leads: 20, qualified: 8, purchases: 3, revenue: 6000 } }, currency: 'INR', range, exportedAt })
const labels = a.columns.map((c) => c.label)
for (const need of ['Ad name', 'Ad ID', 'Campaign ID', 'Ad set ID', 'Created (UTC)', 'Report from (UTC)', 'Report to (UTC)', 'Currency', 'Cost per conversation', 'Cost per lead', 'Return on ad spend', 'Exported at (UTC)']) assert.ok(labels.includes(need), need)
const r = a.rows[0]
assert.deepEqual([r.adName, r.adId, r.currency, r.createdUtc, r.from, r.to, r.exportedUtc], ['Summer Sale — carousel', '1202', 'INR', '2026-09-10T08:30:00.000Z', '2025-11-05T00:00:00.000Z', '2025-12-05T00:00:00.000Z', '2026-11-06T09:00:00.000Z'])
assert.deepEqual([r.costPerConversation, r.costPerLead, r.roas, r.sales, r.leads], [4, 50, 6, 6000, 20])        // 1000/20 leads; 6000/1000 spend
const idle = a.rows[1]
assert.deepEqual([idle.costPerConversation, idle.costPerLead, idle.roas, idle.budget, idle.leads], ['', '', '', '', 0])    // no division by zero, no fake numbers

// as a file: ids stay text, the formula-looking ad text is defused, quotes are escaped
const csv = toCsv(a)
assert.ok(csv.split('\r\n')[0].startsWith('Ad name,Ad ID,'))
assert.ok(csv.includes(`"'=Chat with us, ""now"""`))

/* ── leads: ad name + id per lead, key timestamps, chat status, cost of the conversation ── */
const leads = [{
  id: 'L1', waId: '919876543210', contactName: 'Priya', adName: null, sourceId: '1202', sourceType: 'ad', sourceUrl: 'https://fb.me/x', headline: 'Flat 30% off', ctwaClid: 'ARAk9', createdAt: '2026-11-05T10:05:00Z',
  events: [
    { eventName: 'Purchase', value: 2499, currency: 'INR', status: 'sent', at: '2026-11-06T09:00:00Z' },
    { eventName: 'QualifiedLead', value: null, currency: null, status: 'sent', at: '2026-11-05T14:00:00Z' },
    { eventName: 'LeadSubmitted', value: null, currency: null, status: 'sent', at: '2026-11-05T11:00:00Z' },
    { eventName: 'Purchase', value: 100, currency: 'INR', status: 'failed', at: '2026-11-07T09:00:00Z' },
  ],
}, { id: 'L2', waId: '918800000000', contactName: null, sourceId: null, createdAt: '2026-11-04T10:00:00Z', events: [] }]
const l = leadsExportTable({ leads, ads, currency: 'INR', findChat: (x) => (x.waId === '919876543210' ? { name: 'Priya Sharma', email: 'p@x.in', company: 'Acme', status: 'agent', agentName: 'Rahul' } : null), exportedAt })
const lr = l.rows[0]
assert.deepEqual([lr.adName, lr.adId, lr.campaignName, lr.clickId, lr.startedUtc], ['Summer Sale — carousel', '1202', 'Summer 2026', 'ARAk9', '2026-11-05T10:05:00.000Z'])   // the ad's name is filled in from its id
assert.deepEqual([lr.leadUtc, lr.qualifiedUtc, lr.purchaseUtc], ['2026-11-05T11:00:00.000Z', '2026-11-05T14:00:00.000Z', '2026-11-06T09:00:00.000Z'])
assert.deepEqual([lr.sales, lr.currency, lr.events, lr.costPerConversation], [2499, 'INR', 'Purchase, QualifiedLead, LeadSubmitted', 4])    // the failed purchase is not counted
assert.deepEqual([lr.chatStatus, lr.agent, lr.email, lr.company, lr.name, lr.whatsapp], ['Agent', 'Rahul', 'p@x.in', 'Acme', 'Priya', '+919876543210'])
const orphan = l.rows[1]
assert.deepEqual([orphan.adId, orphan.adName, orphan.costPerConversation, orphan.sales, orphan.chatStatus], ['', '', '', '', ''])
assert.ok(toCsv(l).includes('+919876543210'))                                                           // phone numbers are not mangled

/* ── daily ── */
const d = dailyExportTable({ daily: [{ date: '2026-11-01', spend: 100, impressions: 4000, clicks: 80, conversations: 16 }, { date: '2026-11-02', spend: 0, impressions: 0, clicks: 0, conversations: 0 }], currency: 'INR' })
assert.deepEqual([d.rows[0].ctr, d.rows[0].costPerConversation, d.rows[1].ctr, d.rows[1].costPerConversation], [2, 6.25, '', ''])
console.log('ctwaExports ok')
