import type { ListParams } from './api'
import type { Bot, Channel, Conversation, ConversationStatus, User } from './types'

/**
 * The Conversations tab's filter state, and a predicate mirroring agent-api's
 * list query (conversationRepository.list there). The server does the real
 * filtering on fetch; the predicate lets live events move rows in and out of
 * the current view without refetching, and the chips describe it back to the
 * agent in words.
 */
export type QuickView = 'all' | 'mine' | 'unassigned' | 'waiting'
export type DateRange = 'any' | 'today' | 'last24h' | 'last7' | 'last30'
export type Sort = 'recent' | 'oldest' | 'unread' | 'waiting'

export interface Filters {
  view: QuickView
  botIds: string[]
  channels: Channel[]
  /** Instagram sub-type; only meaningful when Instagram is the only channel. */
  source: 'dm' | 'comment' | 'story' | null
  statuses: ConversationStatus[]
  agentId: string | null
  labels: string[]
  date: DateRange
  starred: boolean
  unread: boolean
  archived: boolean
  sort: Sort
  q: string
}

export const DEFAULT_FILTERS: Filters = {
  view: 'all', botIds: [], channels: [], source: null, statuses: [], agentId: null, labels: [], date: 'any',
  starred: false, unread: false, archived: false, sort: 'recent', q: '',
}

export const SORT_LABEL: Record<Sort, string> = {
  recent: 'Newest first', oldest: 'Oldest first', unread: 'Unread first', waiting: 'Longest waiting',
}
export const DATE_LABEL: Record<DateRange, string> = {
  any: 'Any time', today: 'Today', last24h: 'Last 24 hours', last7: 'Last 7 days', last30: 'Last 30 days',
}
const STATUS_LABEL: Record<ConversationStatus, string> = { bot: 'Bot', agent: 'With agent', resolved: 'Resolved' }
const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', webchat: 'Website' }
const SOURCE_LABEL = { dm: 'DMs', comment: 'Comments', story: 'Story replies' } as const

function dateFrom(range: DateRange): Date | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (range) {
    case 'today': return today
    case 'last24h': return new Date(Date.now() - 86_400_000)
    case 'last7': return new Date(today.getTime() - 6 * 86_400_000)
    case 'last30': return new Date(today.getTime() - 29 * 86_400_000)
    default: return null
  }
}

export function toParams(f: Filters): ListParams {
  return {
    view: f.view === 'all' ? undefined : f.view,
    botIds: f.botIds,
    channels: f.channels,
    source: f.source ?? undefined,
    status: f.statuses,
    agentId: f.agentId ?? undefined,
    labels: f.labels,
    from: dateFrom(f.date)?.toISOString(),
    starred: f.starred || undefined,
    unread: f.unread || undefined,
    archived: f.archived || undefined,
    sort: f.sort === 'recent' ? undefined : f.sort,
    q: f.q.trim() || undefined,
  }
}

export function matches(c: Conversation, f: Filters, meId: string): boolean {
  switch (f.view) {
    case 'mine': if (c.agentId !== meId) return false; break
    case 'unassigned': if (c.agentId || c.status === 'resolved') return false; break
    case 'waiting': if (!c.waitingSince) return false; break
    default: break
  }
  if (f.botIds.length && (!c.botId || !f.botIds.includes(c.botId))) return false
  if (f.channels.length && !f.channels.includes(c.channel)) return false
  if (f.source && c.source !== f.source) return false
  if (f.statuses.length && !f.statuses.includes(c.status)) return false
  if (f.agentId && c.agentId !== f.agentId) return false
  if (f.labels.length && !f.labels.every(l => c.labels.includes(l))) return false
  const from = dateFrom(f.date)
  if (from && new Date(c.timestamp) < from) return false
  if (f.starred && !c.starred) return false
  if (f.unread && c.unread === 0) return false
  if (f.archived !== c.archived) return false
  if (!f.archived && c.snoozed && new Date(c.snoozed).getTime() > Date.now()) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const digits = q.replace(/\D/g, '')
    const hay = [c.name, c.lastMessage, c.identity.primary, c.identity.secondary, c.handle, c.visitorId, ...c.labels]
      .filter(Boolean).join(' ').toLowerCase()
    const phoneHit = digits.length >= 4 && (c.phone ?? '').replace(/\D/g, '').includes(digits)
    if (!hay.includes(q) && !phoneHit) return false
  }
  return true
}

export function compare(sort: Sort) {
  const t = (c: Conversation) => new Date(c.timestamp).getTime()
  return (a: Conversation, b: Conversation) => {
    if (sort === 'oldest') return t(a) - t(b)
    if (sort === 'unread' && (a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1
    if (sort === 'waiting' && !!a.waitingSince !== !!b.waitingSince) return a.waitingSince ? -1 : 1
    if (sort === 'waiting' && a.waitingSince && b.waitingSince) return a.waitingSince < b.waitingSince ? -1 : 1
    return t(b) - t(a)
  }
}

/** One removable chip per active refinement (the quick view and search have their own UI). */
export interface ActiveChip { key: string; label: string; clear: (f: Filters) => Filters }

export function activeChips(f: Filters, bots: Bot[], team: User[]): ActiveChip[] {
  const chips: ActiveChip[] = []
  for (const id of f.botIds) {
    chips.push({ key: `bot:${id}`, label: bots.find(b => b.id === id)?.name ?? 'Bot', clear: x => ({ ...x, botIds: x.botIds.filter(b => b !== id) }) })
  }
  for (const ch of f.channels) {
    chips.push({ key: `ch:${ch}`, label: CHANNEL_LABEL[ch], clear: x => ({ ...x, channels: x.channels.filter(c => c !== ch), source: ch === 'instagram' ? null : x.source }) })
  }
  if (f.source) chips.push({ key: 'src', label: SOURCE_LABEL[f.source], clear: x => ({ ...x, source: null }) })
  for (const s of f.statuses) chips.push({ key: `st:${s}`, label: STATUS_LABEL[s], clear: x => ({ ...x, statuses: x.statuses.filter(y => y !== s) }) })
  if (f.agentId) chips.push({ key: 'agent', label: team.find(u => u.id === f.agentId)?.name ?? 'Agent', clear: x => ({ ...x, agentId: null }) })
  for (const l of f.labels) chips.push({ key: `lb:${l}`, label: `#${l}`, clear: x => ({ ...x, labels: x.labels.filter(y => y !== l) }) })
  if (f.date !== 'any') chips.push({ key: 'date', label: DATE_LABEL[f.date], clear: x => ({ ...x, date: 'any' }) })
  if (f.starred) chips.push({ key: 'starred', label: 'Starred', clear: x => ({ ...x, starred: false }) })
  if (f.unread) chips.push({ key: 'unread', label: 'Unread', clear: x => ({ ...x, unread: false }) })
  if (f.archived) chips.push({ key: 'archived', label: 'Archived', clear: x => ({ ...x, archived: false }) })
  return chips
}

/** Everything except view, sort and search back to defaults. */
export function clearRefinements(f: Filters): Filters {
  return { ...DEFAULT_FILTERS, view: f.view, sort: f.sort, q: f.q }
}
