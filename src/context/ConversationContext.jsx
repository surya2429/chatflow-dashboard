import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { CONVERSATIONS, WEBCHAT_CONVERSATIONS } from '../constants/mockData'

// Matches WebChatFlowBuilder.jsx's FLOW_TEST_STORE_KEY export — duplicated as
// a literal (not imported) to avoid this context pulling in the entire flow
// builder module just for one string constant. Keep these two in sync if
// either changes. Holds every flow-test conversation ever written (keyed by
// conversation id), from both the in-canvas Preview popup and the standalone
// /webchat-flow-preview tab, so any of them survive a reload of this tab.
const FLOW_TEST_STORE_KEY = 'webchat_flow_test_store'

const ConversationContext = createContext(null)

// default channel for conversations without an explicit channel field is 'whatsapp'.
// channelFilter='all' means "all WhatsApp channels" (whatsapp + calls) — it
// deliberately excludes webchat so the WhatsApp inbox's "All chats" view (and
// its badge counts) never pick up Website Chat conversations. The Website
// Chat inbox filters explicitly by channelFilter='webchat'.
//
// Each conversation's `id` here is just its internal record key — it says
// nothing about who the other party is. What identifies *them*, and is what
// screens outside the inbox (like Contacts' "Open Chat") should match on, is
// channel-specific: `phone` for WhatsApp, `handle` for Instagram, and
// `visitorId` for Website Chat (a stand-in for the id a real embeddable
// widget would generate client-side and persist to localStorage — see the
// comment on WEBCHAT_CONVERSATIONS in constants/mockData.js).
function matchChannelGroup(c, channelFilter) {
  const chan = c.channel || 'whatsapp'
  if (channelFilter === 'all')     return chan !== 'webchat'
  if (channelFilter === 'webchat') return chan === 'webchat'
  return chan === channelFilter
}

export function ConversationProvider({ children }) {
  const [conversations, setConversations] = useState([...CONVERSATIONS, ...WEBCHAT_CONVERSATIONS])
  const [activeId, setActiveId] = useState(null)
  // Latest conversations, readable from the plain (non-hook) action functions
  // below without making them depend on render scope — used when persisting a
  // Website Chat conversation that isn't in the store yet, so its existing
  // history comes along rather than the stored record starting from just the
  // one new message.
  const conversationsRef = useRef(conversations)
  useEffect(() => { conversationsRef.current = conversations }, [conversations])
  const [filter, setFilter] = useState('all')           // all | open | pending | bot | agent | resolved | closed
  const [agentFilter, setAgentFilter] = useState('all') // all | unassigned | admin | a1 | a2 | ...
  const [sourceFilter, setSourceFilter] = useState('all') // all | direct | ctwa | g-ctwa | t-ctwa | broadcast
  // all = every WhatsApp channel (whatsapp + calls) — this is the historical
  // default and keeps the WhatsApp inbox scoped away from webchat data.
  // 'webchat' is used explicitly by the Website Chat inbox.
  const [channelFilter, setChannelFilter] = useState('all') // all | whatsapp | calls | webchat
  const [search, setSearch] = useState('')

  // Advanced filter states
  const [dateRange, setDateRange] = useState('all')   // all | today | yesterday | last7 | last30 | custom
  const [dateFrom, setDateFrom] = useState('')         // ISO date string for custom range start
  const [dateTo, setDateTo] = useState('')             // ISO date string for custom range end
  const [labelFilter, setLabelFilter] = useState([])  // array of label strings
  const [starredOnly, setStarredOnly] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [customFieldFilters, setCustomFieldFilters] = useState({}) // { [fieldKey]: selectedValue }

  function setCustomFieldFilter(key, value) {
    setCustomFieldFilters(prev => {
      if (value === '' || value === undefined || value === null) {
        const { [key]: _omit, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: value }
    })
  }
  function clearCustomFieldFilters() { setCustomFieldFilters({}) }

  const active = conversations.find(c => c.id === activeId) || null

  // "allConversations" (used for sidebar/tab badge counts) always reflects every
  // conversation in the current inbox regardless of which sub-filter (whatsapp/
  // calls/etc.) is selected — that's the pre-existing badge-count behavior.
  // The one thing it must never mix is Website Chat with WhatsApp: which side
  // of that split it's on is decided by whether channelFilter is 'webchat'
  // (set by the Website Chat inbox on mount) or anything else (the WhatsApp inbox).
  const channelScoped = conversations.filter(c =>
    channelFilter === 'webchat' ? (c.channel === 'webchat') : (c.channel || 'whatsapp') !== 'webchat'
  )

  const filtered = conversations.filter(c => {
    // 'open'    = bot or agent (live)
    // 'pending' = bot-handled (awaiting agent takeover)
    // 'closed'  = archived chats
    const matchStatus =
      filter === 'all'      ? true :
      filter === 'open'     ? (c.status === 'bot' || c.status === 'agent') :
      filter === 'pending'  ? c.status === 'bot' :
      filter === 'closed'   ? c.archived === true :
      c.status === filter

    const matchAgent   = agentFilter === 'all' || c.agentId === agentFilter || (agentFilter === 'unassigned' && !c.agentId)
    const matchSource  = sourceFilter === 'all' || c.source === sourceFilter
    const matchChannel = matchChannelGroup(c, channelFilter)
    const matchSearch   = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.lastMessage.toLowerCase().includes(search.toLowerCase()) ||
                          (c.phone || '').includes(search) ||
                          (c.labels || []).some(l => l.toLowerCase().includes(search.toLowerCase()))
    // when filter='closed', bypass the archived toggle (show archived automatically)
    const matchArchived = filter === 'closed' ? true : (showArchived ? c.archived : !c.archived)
    const matchStarred  = !starredOnly || c.starred
    const matchUnread   = !unreadOnly || (c.unread || 0) > 0
    const matchLabel    = labelFilter.length === 0 || labelFilter.every(l => (c.labels || []).includes(l))

    // Date range matching using c.timestamp
    let matchDate = true
    if (dateRange !== 'all' && c.timestamp) {
      const d = new Date(c.timestamp)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
      if (dateRange === 'last24')          matchDate = d >= new Date(Date.now() - 24 * 3600 * 1000)
      else if (dateRange === 'today')     matchDate = d >= today
      else if (dateRange === 'yesterday') matchDate = d >= yesterday && d < today
      else if (dateRange === 'last7')     matchDate = d >= new Date(today.getTime() - 6 * 86400000)
      else if (dateRange === 'last30')    matchDate = d >= new Date(today.getTime() - 29 * 86400000)
      else if (dateRange === 'custom' && dateFrom && dateTo) {
        const from = new Date(dateFrom)
        const to   = new Date(dateTo); to.setHours(23, 59, 59)
        matchDate = d >= from && d <= to
      }
    }

    const matchCustomFields = Object.entries(customFieldFilters).every(
      ([key, val]) => (c.customFields || {})[key] === val
    )

    return matchStatus && matchAgent && matchSource && matchChannel && matchSearch && matchArchived && matchStarred && matchUnread && matchLabel && matchDate && matchCustomFields
  })

  function selectConversation(id) {
    setActiveId(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c))
  }

  // Appends a message to a Website Chat conversation's PERSISTED record.
  //
  // React state here is not the source of truth for Website Chat: the
  // conversation list is re-seeded from constants on every load, and the
  // durable copy lives in this store (which the visitor-side surfaces — the
  // Live Preview tab and the landing page — also read and write). So
  // anything the dashboard appends to a Website Chat thread has to be
  // written here too, or it looks right until the next reload and is then
  // simply gone.
  //
  // This covers EVERY webchat conversation, not just the flow-test and
  // landing-page ones: a reply, note or call event on any of them is just as
  // real, and previously only the `flowtest_`-prefixed ones survived. A
  // conversation that has no stored record yet gets one seeded from its
  // current in-memory state, so its existing history is carried over rather
  // than the stored copy starting at this single new message.
  function persistWebchatMessage(conversationId, message, { updateLastMessage = true } = {}) {
    try {
      const store = JSON.parse(localStorage.getItem(FLOW_TEST_STORE_KEY) || '{}')
      const base = store[conversationId]
        || conversationsRef.current.find(c => c.id === conversationId && c.channel === 'webchat')
      if (!base) return // not a Website Chat conversation — nothing to persist
      if ((base.messages || []).some(m => m.id === message.id)) return // already stored
      store[conversationId] = {
        ...base,
        messages: [...(base.messages || []), message],
        ...(updateLastMessage ? { lastMessage: message.text } : null),
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(FLOW_TEST_STORE_KEY, JSON.stringify(store))
    } catch {}
  }

  function sendMessage(conversationId, text) {
    const newMsg = {
      id: `m${Date.now()}`,
      type: 'outgoing',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: 'Agent',
    }
    setConversations(prev =>
      prev.map(c => c.id === conversationId
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: text }
        : c
      )
    )
    // A flow-test thread has a real, currently running visitor-side widget
    // somewhere — the standalone Live Preview tab, or the in-canvas Preview
    // popup — that has no other way to learn an agent just replied. Writing
    // this message into the same persisted store those surfaces already
    // read/write lets WebChatFlowBuilder.jsx's useAgentReplyBridge
    // (listening for `storage` events on this key) pick it up and inject it
    // into that live session, so the reply actually reaches "the visitor"
    // instead of only ever landing in the Inbox's own record of the
    // conversation. (Landing-page visitors don't have a live chat
    // simulation to inject into, but still need the persistence.)
    persistWebchatMessage(conversationId, newMsg)
  }

  // Same durability problem as persistWebchatMessage, for the fields an agent
  // changes rather than the message log. These have to be stored too: the
  // visitor-side surfaces rewrite a thread's stored record whenever the
  // visitor sends anything, carrying the stored values forward — so an
  // unpersisted takeover/assignment/label would be reverted by the visitor's
  // very next message, and lost outright on reload.
  function persistWebchatPatch(conversationId, patch) {
    try {
      const store = JSON.parse(localStorage.getItem(FLOW_TEST_STORE_KEY) || '{}')
      const base = store[conversationId]
        || conversationsRef.current.find(c => c.id === conversationId && c.channel === 'webchat')
      if (!base) return
      store[conversationId] = { ...base, ...patch }
      localStorage.setItem(FLOW_TEST_STORE_KEY, JSON.stringify(store))
    } catch {}
  }

  function patchConversation(id, patch) {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    persistWebchatPatch(id, patch)
  }

  function takeoverConversation(id) {
    patchConversation(id, { status: 'agent', agentId: 'admin', agentName: 'Deepak Kumar' })
  }

  function resolveConversation(id) {
    patchConversation(id, { status: 'resolved', unread: 0 })
  }

  function returnToBot(id) {
    patchConversation(id, { status: 'bot', agentId: null, agentName: null })
  }

  function assignAgent(conversationId, agentId, agentName) {
    patchConversation(conversationId, { status: 'agent', agentId, agentName })
  }

  function toggleStar(id) {
    const current = conversationsRef.current.find(c => c.id === id)
    patchConversation(id, { starred: !current?.starred })
  }

  function archiveConversation(id) {
    patchConversation(id, { archived: true })
  }

  function snoozeConversation(id, until) {
    patchConversation(id, { snoozed: until })
  }

  function addConversation(conv) {
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
  }

  // Insert-or-update by id — unlike addConversation (always prepends a new
  // record), this keeps re-syncing the SAME conversation in place instead of
  // spawning a fresh duplicate every time it's called. Used to mirror a
  // Flow Builder test session into the Inbox as one continuously-updated
  // thread (see buildFlowTestConversation in WebChatFlowBuilder.jsx) rather
  // than a new "chat" appearing every time someone re-runs Preview.
  function upsertConversation(conv) {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conv.id)
      if (idx === -1) return [conv, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...conv }
      return next
    })
  }

  // Picks up flow tests run either in this tab's own in-canvas Preview popup
  // (which also calls upsertConversation directly, but needs this too so the
  // thread survives a reload) or in the standalone /webchat-flow-preview tab
  // (a separate, unauthenticated page with no access to this context at all
  // — see the comment on FLOW_TEST_STORE_KEY above). A `storage` event fires
  // here whenever another tab writes to that key, so a flow tested in a
  // fresh "Live Preview" tab shows up in the Inbox without needing a manual
  // refresh. Also checked once on mount to restore anything written earlier
  // (by either surface), including in a previous, now-reloaded page load.
  const syncFlowTest = useCallback(() => {
    try {
      const store = JSON.parse(localStorage.getItem(FLOW_TEST_STORE_KEY) || '{}')
      Object.values(store).forEach(raw => {
        if (raw && raw.id && Array.isArray(raw.messages)) upsertConversation(raw)
      })
    } catch {}
  }, [])
  useEffect(() => {
    syncFlowTest()
    const onStorage = e => { if (e.key === FLOW_TEST_STORE_KEY) syncFlowTest() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [syncFlowTest])

  function addLabel(id, label) {
    const current = conversationsRef.current.find(c => c.id === id)
    if (current?.labels?.includes(label)) return
    patchConversation(id, { labels: [...(current?.labels || []), label] })
  }

  function removeLabel(id, label) {
    const current = conversationsRef.current.find(c => c.id === id)
    patchConversation(id, { labels: (current?.labels || []).filter(l => l !== label) })
  }

  function addNote(id, text, sender) {
    const note = {
      id: `n${Date.now()}`,
      type: 'note',
      text,
      sender,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, messages: [...c.messages, note] } : c
    ))
    // Same persistence gap as sendMessage/logEvent — a private note is still
    // a real message in the thread and must survive a reload, but (unlike a
    // reply) shouldn't overwrite the Inbox list's public lastMessage preview.
    persistWebchatMessage(id, note, { updateLastMessage: false })
  }

  // A generic `type: 'event'` system message — same shape the mock call-log
  // entries in constants/mockData.js already use (call_missed/call_answered/
  // assigned/bot_handover), now the real path WebchatCallContext.jsx logs
  // actual Website Chat calls through. Also bumps `lastMessage` so the
  // Inbox list preview reflects it, matching how a real call shows up there
  // (e.g. "📞 Inbound call · 5m 40s · Answered").
  function logEvent(id, event, text) {
    const entry = {
      id: `e${Date.now()}`,
      type: 'event',
      event,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, messages: [...c.messages, entry], lastMessage: text } : c
    ))
    // Same reasoning as sendMessage's persist call — a logged call outcome is
    // exactly as real as any other message in the thread, and without this it
    // silently disappeared on the next reload.
    persistWebchatMessage(id, entry)
  }

  return (
    <ConversationContext.Provider value={{
      conversations: filtered,
      allConversations: channelScoped,
      // Unfiltered by channelFilter/status/etc — for lookups from screens that
      // aren't the inbox itself (e.g. a Contacts page jumping to a contact's
      // conversation) and can't rely on channelFilter already being scoped
      // the way the inbox page scopes it on mount.
      everyConversation: conversations,
      active,
      activeId,
      filter,
      agentFilter,
      sourceFilter,
      channelFilter,
      search,
      dateRange,
      dateFrom,
      dateTo,
      labelFilter,
      starredOnly,
      unreadOnly,
      showArchived,
      customFieldFilters,
      setCustomFieldFilter,
      clearCustomFieldFilters,
      setFilter,
      setAgentFilter,
      setSourceFilter,
      setChannelFilter,
      setSearch,
      setDateRange,
      setDateFrom,
      setDateTo,
      setLabelFilter,
      setStarredOnly,
      setUnreadOnly,
      setShowArchived,
      selectConversation,
      sendMessage,
      takeoverConversation,
      resolveConversation,
      returnToBot,
      assignAgent,
      toggleStar,
      archiveConversation,
      snoozeConversation,
      addConversation,
      upsertConversation,
      addLabel,
      removeLabel,
      addNote,
      logEvent,
    }}>
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversations() {
  const ctx = useContext(ConversationContext)
  if (!ctx) throw new Error('useConversations must be used within ConversationProvider')
  return ctx
}
