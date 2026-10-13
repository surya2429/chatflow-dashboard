// usageSql.ts — counts a sent WhatsApp message against the client that owns the sending number.
// Used by the queue workers (a separate process from the billing API), so it writes straight to
// billing_usage in one statement: find the workspace whose whatsappNumbers include this
// phone_number_id (staff set them on the client page), and add 1 for today (IST).
import { query } from '../db/pool.js'

/** Meta's category → the allowance it uses: service conversations, OTP (authentication) templates, everything else business-initiated. */
const metricFor = (category: string) => (category === 'service' ? 'wa_service' : category === 'authentication' ? 'wa_otps' : 'wa_bi')

export async function countWhatsAppMessage(phoneNumberId: string, category: string): Promise<void> {
  await query(
    `INSERT INTO billing_usage (workspace_id, day, metric, value)
     SELECT workspace_id, (now() AT TIME ZONE 'Asia/Kolkata')::date, $2, 1
       FROM billing_records WHERE data->'whatsappNumbers' ? $1 LIMIT 1
     ON CONFLICT (workspace_id, day, metric) DO UPDATE SET value = billing_usage.value + 1`,
    [phoneNumberId, metricFor(category)],
  )
}
