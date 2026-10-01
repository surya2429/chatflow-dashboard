import { API_URL } from './config'
import { NetworkError, adopt, getAccessToken, refreshAccessToken } from './session'
import type {
  Attachment, Bot, Contact, ContactPanel, Conversation, Message, Presence, Session, Template, User,
} from './types'

export type AnalyticsRange = 'today' | '7d' | '30d' | 'custom'
/** Whole calendar days, both ends included, as YYYY-MM-DD in this device's time zone. */
export interface DateSpan { from: string; to: string }
export interface AnalyticsKpis {
  conversations: number
  messages: number
  resolved: number
  /** Median seconds from a customer message to the agent's reply. */
  replySec: number | null
  /** Average seconds from the agent's first message in a chat to resolving it. */
  avgHandleSec: number | null
  resolutionRate: number | null
}
export interface AgentAnalytics {
  range: { key: AnalyticsRange; days: number; from: string; to: string; tz: string; startDate: string; endDate: string }
  agent: { id: string; name: string; initials: string; color: string; role: string }
  kpis: AnalyticsKpis
  previous: AnalyticsKpis
  daily: { date: string; conversations: number; messages: number; resolved: number; replySec: number | null }[]
  byHour: number[]
  byChannel: { whatsapp: number; instagram: number; webchat: number }
  team: ({ id: string; name: string; initials: string; color: string; role: string } & AnalyticsKpis)[]
}

export type NotifyCategory = 'assignments' | 'messages' | 'waiting' | 'calls'
export interface NotificationSettings {
  /** Which pushes you want — the same on every device you sign in on. */
  categories: Record<NotifyCategory, boolean>
  /** This phone's own switch; null when it isn't registered for push (web, simulator, permission never given). */
  device: { pushEnabled: boolean; registered: boolean } | null
}

/** A file picked on the device, before upload. */
export interface PickedFile { uri: string; name: string; mime: string; size?: number; width?: number; height?: number }

/** Signed file paths come back relative to the API; images and links need the full URL. */
export const fileUrl = (url: string) => (/^https?:/.test(url) ? url : `${API_URL}${url}`)

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) {
    super(message)
  }
}

/**
 * Authenticated fetch. On 401 `token_expired` it refreshes once and retries;
 * any other 401 means the session is gone (session.ts has already signed out).
 */
async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; raw?: { data: Blob; headers: Record<string, string> } } = {},
  retried = false,
): Promise<T> {
  const token = await getAccessToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? (init.body !== undefined || init.raw ? 'POST' : 'GET'),
      headers: {
        ...(init.raw ? init.raw.headers : { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: init.raw ? init.raw.data : init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new NetworkError()
  }
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({}))
  if (res.status === 401 && !retried && (json.error === 'token_expired' || json.error === 'missing_token')) {
    const fresh = await refreshAccessToken().catch(() => null)
    if (fresh) return request<T>(path, init, true)
  }
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'error', json.message ?? `Request failed (${res.status})`, json.details)
  return json as T
}

const q = (params: Record<string, string | number | boolean | undefined | null | string[]>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`)
    .join('&')
  return s ? `?${s}` : ''
}

export interface ListParams {
  view?: 'all' | 'active' | 'mine' | 'unassigned' | 'waiting'
  botIds?: string[]
  channels?: string[]
  sort?: 'recent' | 'oldest' | 'unread' | 'waiting'
  bucket?: 'open' | 'pending' | 'solved' | 'unread' | 'favourite' | 'last24h'
  channel?: 'whatsapp' | 'instagram' | 'webchat'
  source?: string
  status?: string[]
  agentId?: string
  labels?: string[]
  from?: string
  to?: string
  starred?: boolean
  unread?: boolean
  archived?: boolean
  q?: string
  cursor?: string
  limit?: number
}

export const api = {
  // auth
  async login(email: string, password: string, deviceId: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId }),
    }).catch(() => { throw new NetworkError() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(res.status, json.error ?? 'error', json.message ?? 'Sign in failed')
    await adopt(json as Session)
    return json as Session
  },
  me: () => request<{ user: User; capabilities: string[] }>('/auth/me'),

  // inbox
  conversations: (p: ListParams) => request<{ items: Conversation[]; nextCursor: string | null }>(`/conversations${q({ ...p })}`),
  counts: (opts: { channel?: string; botId?: string } = {}) => request<Record<string, number>>(`/conversations/counts${q(opts)}`),
  bots: () => request<{ items: Bot[] }>('/bots'),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  messages: (id: string, before?: string) => request<{ items: Message[]; hasMore: boolean }>(`/conversations/${id}/messages${q({ before, limit: 50 })}`),
  agentAnalytics: (range: AnalyticsRange, agentId?: string, span?: DateSpan) =>
    request<AgentAnalytics>(`/analytics/agent${q({
      range, agentId, from: range === 'custom' ? span?.from : undefined, to: range === 'custom' ? span?.to : undefined,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })}`),
  send: (id: string, body: { text: string; clientMsgId: string; igReplyMode?: 'public' | 'private'; attachmentId?: string }) =>
    request<Message>(`/conversations/${id}/messages`, { body }),
  /** Uploads a picked file for a reply in this conversation; send it with `attachmentId`. */
  async uploadAttachment(id: string, file: PickedFile): Promise<Attachment> {
    let data: Blob
    try { data = await (await fetch(file.uri)).blob() } catch { throw new ApiError(0, 'file_unreadable', 'Couldn’t read that file') }
    return request<Attachment>(`/conversations/${id}/attachments`, {
      raw: { data, headers: { 'Content-Type': file.mime, 'X-File-Name': encodeURIComponent(file.name) } },
    })
  },
  sendTemplate: (id: string, body: { templateId: string; variables: string[]; clientMsgId: string }) =>
    request<Message>(`/conversations/${id}/templates`, { body }),
  note: (id: string, text: string) => request<Message>(`/conversations/${id}/notes`, { body: { text } }),
  markRead: (id: string) => request<Conversation>(`/conversations/${id}/read`, { body: {} }),
  takeover: (id: string) => request<Conversation>(`/conversations/${id}/takeover`, { body: {} }),
  transfer: (id: string, toUserId: string) => request<Conversation>(`/conversations/${id}/transfer`, { body: { toUserId } }),
  resolve: (id: string) => request<Conversation>(`/conversations/${id}/resolve`, { body: {} }),
  returnToBot: (id: string) => request<Conversation>(`/conversations/${id}/return-to-bot`, { body: {} }),
  snooze: (id: string, until: string | null) => request<Conversation>(`/conversations/${id}/snooze`, { body: { until } }),
  star: (id: string, starred: boolean) => request<Conversation>(`/conversations/${id}/star`, { body: { starred } }),
  archive: (id: string, archived: boolean) => request<Conversation>(`/conversations/${id}/archive`, { body: { archived } }),
  addLabel: (id: string, label: string) => request<Conversation>(`/conversations/${id}/labels`, { body: { label } }),
  removeLabel: (id: string, label: string) =>
    request<Conversation>(`/conversations/${id}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' }),

  // starting conversations
  startWhatsApp: (body: { phone: string; name: string; templateId: string; variables: string[]; clientMsgId: string; botId?: string }) =>
    request<{ conversationId: string; message: Message }>('/conversations/start/whatsapp', { body }),
  startInstagram: (body: { contactId: string; text: string; clientMsgId: string; botId?: string }) =>
    request<{ conversationId: string; message: Message }>('/conversations/start/instagram', { body }),
  instagramFollowers: (search?: string) => request<{ items: Contact[] }>(`/instagram/followers${q({ q: search })}`),

  // contacts, templates, team
  contact: (id: string) => request<ContactPanel>(`/contacts/${id}`),
  updateContact: (id: string, body: { name?: string; profile?: Record<string, string | null>; customFields?: Record<string, string | null> }) =>
    request<Contact>(`/contacts/${id}`, { method: 'PATCH', body }),
  templates: () => request<{ items: Template[] }>('/templates'),
  team: () => request<{ items: User[] }>('/team'),

  // presence, devices, calls
  setPresence: (presence: Presence) => request<{ user: User | null; routed: number }>('/me/presence', { method: 'PUT', body: { presence } }),
  heartbeat: () => request<void>('/me/heartbeat', { body: {} }),
  registerDevice: (body: { deviceId: string; platform: 'ios' | 'android'; pushToken?: string | null; voipToken?: string | null; appVersion?: string }) =>
    request<{ deviceId: string }>('/me/devices', { method: 'PUT', body }),
  notificationSettings: (deviceId: string) => request<NotificationSettings>(`/me/notifications${q({ deviceId })}`),
  updateNotificationSettings: (body: { deviceId?: string; pushEnabled?: boolean; categories?: Partial<Record<NotifyCategory, boolean>> }) =>
    request<NotificationSettings>('/me/notifications', { method: 'PUT', body }),
  iceServers: () => request<{ iceServers: RTCIceServerLike[]; turn: boolean }>('/calls/ice-servers'),
}

export interface RTCIceServerLike { urls: string | string[]; username?: string; credential?: string }

/** A friendly sentence for an error, for toasts and inline banners. */
export function errorMessage(err: unknown): string {
  if (err instanceof NetworkError) return "You're offline — check your connection and try again."
  if (err instanceof ApiError) return err.message
  return 'Something went wrong. Please try again.'
}
