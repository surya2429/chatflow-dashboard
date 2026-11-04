/* Meta Reports client — GET /api/whatsapp/meta-reports (backend/src/whatsapp/metaReports.ts).
   The access token stays on the server; the browser only names a date range (unix seconds). */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function fetchMetaReport(start, end) {
  const res = await fetch(`${API_BASE_URL}/whatsapp/meta-reports?start=${start}&end=${end}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.message || `Request failed (${res.status})`)
    err.code = body.error
    throw err
  }
  return body
}
