// messageLinks.ts — WhatsApp "message links" / QR codes: a short wa.me/message/<code> link (and the QR that
// encodes it) that opens a chat with the business with a message already typed in.
//
// Meta's QR Codes and Short Links API, on the business phone number:
//   POST   /{phone-number-id}/message_qrdls   { prefilled_message, generate_qr_image: "SVG" | "PNG" }   create
//   GET    /{phone-number-id}/message_qrdls                                                           list
//   POST   /{phone-number-id}/message_qrdls   { code, prefilled_message }                             update
//   DELETE /{phone-number-id}/message_qrdls/{code}                                                    delete
// Limits: prefilled_message ≤ 140 characters; ≤ 2,000 links per number; no analytics.
// Meta returns qr_image_url only when a code is created, and no creation date at all, so the dashboard draws
// the QR itself from deep_link_url and does not show a "date created".
//
// Pure: no env, no DB. Callers pass the phone number id, token and API version.

export const MAX_MESSAGE_CHARS = 140

export interface MessageLink {
  code: string
  prefilledMessage: string
  /** https://wa.me/message/<code> */
  deepLinkUrl: string
  /** Only present on the create response. */
  qrImageUrl?: string
}

export interface MessageLinkCreds { phoneNumberId?: string; accessToken?: string; version: string }

interface GraphError { error?: { message?: string; code?: number } }
interface RawLink { code: string; prefilled_message: string; deep_link_url: string; qr_image_url?: string }

export class MessageLinkError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) { super(message) }
}

const toLink = (r: RawLink): MessageLink => ({
  code: r.code,
  prefilledMessage: r.prefilled_message,
  deepLinkUrl: r.deep_link_url,
  ...(r.qr_image_url ? { qrImageUrl: r.qr_image_url } : {}),
})

async function graph<T>(f: typeof fetch, creds: Required<MessageLinkCreds>, method: string, path: string, body?: unknown): Promise<T> {
  const res = await f(`https://graph.facebook.com/${creds.version}/${encodeURIComponent(creds.phoneNumberId)}/message_qrdls${path}`, {
    method,
    headers: { Authorization: `Bearer ${creds.accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = (await res.json().catch(() => ({}))) as T & GraphError
  if (!res.ok || json.error) throw new MessageLinkError(json.error?.message ?? `Meta API returned ${res.status}`, res.status, json.error?.code)
  return json
}

export interface MessageLinkRequest {
  method: string
  /** the link code, for update and delete */
  code?: string
  body?: Record<string, unknown>
}

/** Validates the request and runs it against Meta. Shared by the API route and the Vite dev server. */
export async function messageLinkResponse(
  req: MessageLinkRequest,
  creds: MessageLinkCreds,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: unknown }> {
  if (!creds.phoneNumberId || !creds.accessToken) return { status: 200, body: { configured: false } }
  const c = creds as Required<MessageLinkCreds>
  const bad = (message: string) => ({ status: 400, body: { error: 'invalid_request', message } })

  // The code goes into a URL path: only the characters Meta uses, never anything that could change the route.
  if (req.code !== undefined && !/^[A-Za-z0-9_-]{4,64}$/.test(req.code)) return bad('That link code is not valid.')

  let message = ''
  if (req.method === 'POST' || req.method === 'PUT') {
    const m = req.body?.prefilledMessage
    if (typeof m !== 'string' || !m.trim()) return bad('Write the message people will see pre-filled.')
    if ([...m].length > MAX_MESSAGE_CHARS) return bad(`The message can be at most ${MAX_MESSAGE_CHARS} characters.`)
    message = m.trim()
  }

  try {
    if (req.method === 'GET') {
      const r = await graph<{ data?: RawLink[] }>(fetchImpl, c, 'GET', '')
      return { status: 200, body: { configured: true, items: (r.data ?? []).map(toLink) } }
    }
    if (req.method === 'POST' && req.code === undefined) {
      const r = await graph<RawLink>(fetchImpl, c, 'POST', '', { prefilled_message: message, generate_qr_image: 'SVG' })
      return { status: 201, body: toLink(r) }
    }
    if (req.method === 'PUT' && req.code !== undefined) {
      const r = await graph<RawLink>(fetchImpl, c, 'POST', '', { code: req.code, prefilled_message: message })
      return { status: 200, body: toLink(r) }
    }
    if (req.method === 'DELETE' && req.code !== undefined) {
      await graph<{ success?: boolean }>(fetchImpl, c, 'DELETE', `/${encodeURIComponent(req.code)}`)
      return { status: 200, body: { success: true } }
    }
    return { status: 405, body: { error: 'method_not_allowed' } }
  } catch (err) {
    // Expired token, missing whatsapp_business_management permission, over the 2,000-link cap…: the merchant's to fix.
    if (err instanceof MessageLinkError) return { status: 502, body: { error: 'meta_error', message: err.message, code: err.code ?? null } }
    throw err
  }
}
