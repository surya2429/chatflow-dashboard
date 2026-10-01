import { useSyncExternalStore } from 'react'
import type { Bot, Conversation, Message, User } from './types'
import { DEFAULT_FILTERS, type Filters } from './filters'

/**
 * The client-side cache every screen reads from, kept current by the live
 * stream. Applying server data is idempotent by construction:
 *
 *   - A conversation is replaced only by a strictly newer `version`. A
 *     replayed or out-of-order event can never roll a row backwards — the
 *     same rule as the dashboard's live bot-config stream.
 *   - A message is keyed by id; an optimistic send is matched to its server
 *     copy by clientMsgId, so it's swapped in place rather than duplicated.
 */
export type ConnectionState = 'connecting' | 'live' | 'offline'

interface Thread { items: Message[]; hasMore: boolean; loaded: boolean }

interface State {
  conversations: Record<string, Conversation>
  threads: Record<string, Thread>
  team: User[]
  connection: ConnectionState
  /** The conversation on screen — its pushes are suppressed and reads are marked. */
  activeConversationId: string | null
  /** Bumped when the server says our event position is too old: lists refetch. */
  resyncToken: number
  bots: Bot[]
  activeUserId: string | null
  /** The Conversations tab's filters — shared, so tapping a bot on Home can set them. */
  filters: Filters
}

let state: State = {
  conversations: {}, threads: {}, team: [], connection: 'connecting', activeConversationId: null, resyncToken: 0,
  bots: [], filters: DEFAULT_FILTERS, activeUserId: null,
}
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function getState() { return state }

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => selector(state),
    () => selector(state),
  )
}

function sortThread(items: Message[]) {
  return items.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
}

export const store = {
  upsertConversations(list: Conversation[]) {
    let changed = false
    const next = { ...state.conversations }
    for (const c of list) {
      const held = next[c.id]
      if (held && held.version >= c.version) continue
      next[c.id] = c
      changed = true
    }
    if (changed) set({ conversations: next })
  },

  /** Optimistic local edit (e.g. star toggled) — overwritten by the server's next version. */
  patchConversationLocally(id: string, patch: Partial<Conversation>) {
    const held = state.conversations[id]
    if (held) set({ conversations: { ...state.conversations, [id]: { ...held, ...patch } } })
  },

  setThread(conversationId: string, page: { items: Message[]; hasMore: boolean }, mode: 'replace' | 'prepend') {
    const held = state.threads[conversationId]
    const base = mode === 'prepend' && held ? held.items : held?.items.filter(m => m.local) ?? []
    const byId = new Map<string, Message>()
    for (const m of [...page.items, ...base]) if (!byId.has(m.id)) byId.set(m.id, m)
    set({
      threads: {
        ...state.threads,
        [conversationId]: { items: sortThread([...byId.values()]), hasMore: mode === 'prepend' || !held ? page.hasMore : held.hasMore, loaded: true },
      },
    })
  },

  upsertMessage(m: Message) {
    const thread = state.threads[m.conversationId]
    if (!thread) return // not open — the list preview comes from the conversation event
    const items = thread.items.filter(x => x.id !== m.id && !(m.clientMsgId && x.clientMsgId === m.clientMsgId && x.local))
    items.push(m)
    set({ threads: { ...state.threads, [m.conversationId]: { ...thread, items: sortThread(items) } } })
  },

  markLocalFailed(conversationId: string, clientMsgId: string) {
    const thread = state.threads[conversationId]
    if (!thread) return
    const items = thread.items.map(x => (x.clientMsgId === clientMsgId && x.local ? { ...x, local: 'failed' as const } : x))
    set({ threads: { ...state.threads, [conversationId]: { ...thread, items } } })
  },

  removeLocal(conversationId: string, clientMsgId: string) {
    const thread = state.threads[conversationId]
    if (!thread) return
    set({ threads: { ...state.threads, [conversationId]: { ...thread, items: thread.items.filter(x => x.clientMsgId !== clientMsgId) } } })
  },

  setTeam(team: User[]) { set({ team }) },
  setBots(bots: Bot[]) { set({ bots }) },
  setActiveUser(activeUserId: string | null) { set({ activeUserId }) },
  setFilters(next: Filters | ((f: Filters) => Filters)) {
    set({ filters: typeof next === 'function' ? next(state.filters) : next })
  },
  patchTeamMember(id: string, patch: Partial<User>) {
    set({ team: state.team.map(u => (u.id === id ? { ...u, ...patch } : u)) })
  },
  setConnection(connection: ConnectionState) { if (state.connection !== connection) set({ connection }) },
  setActiveConversation(id: string | null) { set({ activeConversationId: id }) },
  requestResync() { set({ resyncToken: state.resyncToken + 1, threads: {} }) },
  reset() {
    set({ conversations: {}, threads: {}, team: [], bots: [], filters: DEFAULT_FILTERS, activeUserId: null, connection: 'connecting', activeConversationId: null, resyncToken: state.resyncToken + 1 })
  },
}
