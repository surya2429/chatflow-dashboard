/* WhatsApp message links / QR codes client — /api/whatsapp/message-links (backend/src/whatsapp/messageLinks.ts).
   The access token stays on the server. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const MAX_MESSAGE_CHARS = 140

async function call(method, path, body) {
  const res = await fetch(`${API_BASE_URL}/whatsapp/message-links${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.message || `Request failed (${res.status})`)
    err.code = json.error
    throw err
  }
  return json
}

export const messageLinks = {
  list:   ()                      => call('GET', ''),
  create: (prefilledMessage)      => call('POST', '', { prefilledMessage }),
  update: (code, prefilledMessage) => call('PUT', `/${encodeURIComponent(code)}`, { prefilledMessage }),
  remove: (code)                  => call('DELETE', `/${encodeURIComponent(code)}`),
}
