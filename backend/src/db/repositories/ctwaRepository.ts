import { query } from '../pool.js'
import type { CtwaStore, Lead, LeadEvent, LeadStats } from '../../ctwa/types.js'

interface Row {
  id: string; wa_id: string; contact_name: string | null; ctwa_clid: string | null; source_id: string | null; source_type: string | null
  source_url: string | null; headline: string | null; body: string | null; media_type: string | null; media_url: string | null
  welcome_text: string | null; wa_message_id: string; phone_number_id: string | null; created_at: Date
  events: { eventName: string; value: string | number | null; currency: string | null; status: LeadEvent['status']; error: string | null; at: string }[]
}

const toLead = (r: Row): Lead => ({
  id: r.id, waId: r.wa_id, contactName: r.contact_name, ctwaClid: r.ctwa_clid, sourceId: r.source_id, sourceType: r.source_type, sourceUrl: r.source_url,
  headline: r.headline, body: r.body, mediaType: r.media_type, mediaUrl: r.media_url, welcomeText: r.welcome_text, waMessageId: r.wa_message_id,
  phoneNumberId: r.phone_number_id, createdAt: r.created_at.toISOString(), adName: null,
  events: r.events.map((e) => ({ ...e, value: e.value === null ? null : Number(e.value) })),
})

// one row per referral, its events folded into a JSON array
const SELECT = `
  SELECT r.*, COALESCE(json_agg(json_build_object('eventName', e.event_name, 'value', e.value, 'currency', e.currency, 'status', e.status, 'error', e.error, 'at', e.created_at)
                                 ORDER BY e.created_at) FILTER (WHERE e.id IS NOT NULL), '[]') AS events
  FROM ctwa_referrals r LEFT JOIN ctwa_events e ON e.referral_id = r.id`

export const ctwaRepository: CtwaStore = {
  async saveReferral(r) {
    const rows = await query(
      `INSERT INTO ctwa_referrals (wa_id, contact_name, ctwa_clid, source_id, source_type, source_url, headline, body, media_type, media_url, welcome_text, wa_message_id, phone_number_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`,
      [r.waId, r.contactName, r.ctwaClid, r.sourceId, r.sourceType, r.sourceUrl, r.headline, r.body, r.mediaType, r.mediaUrl, r.welcomeText, r.waMessageId, r.phoneNumberId, r.createdAt],
    )
    return rows.length > 0
  },

  async listLeads(limit, sourceId) {
    return (await query<Row>(`${SELECT} WHERE ($2::text IS NULL OR r.source_id = $2) GROUP BY r.id ORDER BY r.created_at DESC LIMIT $1`, [limit, sourceId ?? null])).map(toLead)
  },

  async statsBySource(range) {
    const rows = await query<{ source_id: string; leads: string; qualified: string; purchases: string; revenue: string }>(
      `SELECT r.source_id,
              count(DISTINCT r.id) AS leads,
              count(DISTINCT r.id) FILTER (WHERE e.event_name = 'QualifiedLead' AND e.status = 'sent') AS qualified,
              count(e.id) FILTER (WHERE e.event_name = 'Purchase' AND e.status = 'sent') AS purchases,
              COALESCE(sum(e.value) FILTER (WHERE e.event_name = 'Purchase' AND e.status = 'sent'), 0) AS revenue
         FROM ctwa_referrals r LEFT JOIN ctwa_events e ON e.referral_id = r.id
        WHERE r.source_id IS NOT NULL AND r.created_at >= to_timestamp($1) AND r.created_at <= to_timestamp($2) + interval '1 second'
        GROUP BY r.source_id`, [range.start, range.end])
    const out: Record<string, LeadStats> = {}
    for (const r of rows) out[r.source_id] = { leads: Number(r.leads), qualified: Number(r.qualified), purchases: Number(r.purchases), revenue: Number(r.revenue) }
    return out
  },

  async latestForWaId(waId) {
    const rows = await query<Row>(`${SELECT} WHERE r.wa_id = $1 GROUP BY r.id ORDER BY r.created_at DESC LIMIT 1`, [waId])
    return rows[0] ? toLead(rows[0]) : null
  },

  async logEvent(waId, ctwaClid, e) {
    const ref = await query<{ id: string }>(
      `SELECT id FROM ctwa_referrals WHERE wa_id = $1 AND ($2::text IS NULL OR ctwa_clid = $2) ORDER BY created_at DESC LIMIT 1`, [waId, ctwaClid])
    if (!ref[0]) return
    await query(`INSERT INTO ctwa_events (referral_id, event_name, value, currency, status, error) VALUES ($1,$2,$3,$4,$5,$6)`,
      [ref[0].id, e.eventName, e.value, e.currency, e.status === 'simulated' ? 'sent' : e.status, e.error])
  },
}
