import { query, withTransaction } from '../pool.js'

export interface Contact {
  id: string
  wa_id: string
  phone_number: string
  display_name: string | null
  profile_name: string | null
  marketing_consent: boolean
  consent_source: string | null
  consent_updated_at: string | null
  opted_out_at: string | null
  tags: string[]
  attributes: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const contactRepository = {
  async findByWaId(waId: string): Promise<Contact | null> {
    const rows = await query<Contact>('SELECT * FROM contacts WHERE wa_id = $1', [waId])
    return rows[0] ?? null
  },

  /** Upsert on inbound webhook — Meta sends `contacts[].profile.name` with every event. */
  async upsertFromWebhook(waId: string, phoneNumber: string, profileName: string | undefined): Promise<Contact> {
    const rows = await query<Contact>(
      `INSERT INTO contacts (wa_id, phone_number, profile_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (wa_id) DO UPDATE
         SET profile_name = COALESCE(EXCLUDED.profile_name, contacts.profile_name),
             phone_number  = EXCLUDED.phone_number
       RETURNING *`,
      [waId, phoneNumber, profileName ?? null],
    )
    const contact = rows[0]
    if (!contact) throw new Error(`Failed to upsert contact for wa_id=${waId}`)
    return contact
  },

  async setMarketingConsent(
    waId: string,
    consent: boolean,
    source: 'signup_form' | 'inbound_message' | 'manual_import' | 'api' | 'admin_override',
    reason?: string,
  ): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE contacts
         SET marketing_consent = $2,
             consent_source = $3,
             consent_updated_at = now(),
             opted_out_at = CASE WHEN $2 = false THEN now() ELSE NULL END,
             opted_out_reason = CASE WHEN $2 = false THEN $4 ELSE NULL END
         WHERE wa_id = $1`,
        [waId, consent, source, reason ?? null],
      )
    })
  },
}
