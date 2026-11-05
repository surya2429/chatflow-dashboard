import { query } from '../pool.js'
import type { PoweredByLead } from '../../leads/poweredByLead.js'

export const leadRepository = {
  async createDemoLead(l: PoweredByLead): Promise<void> {
    await query(
      `INSERT INTO demo_leads (name, email, phone, company, website, source_url) VALUES ($1, $2, $3, $4, $5, $6)`,
      [l.name, l.email, l.phone, l.company, l.website, l.sourceUrl],
    )
  },
}
