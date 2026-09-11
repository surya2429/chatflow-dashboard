import { createContext, useContext, useState, useEffect, useCallback } from 'react'
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
    // A flow-test thread (id prefixed `flowtest_`) has a real, currently
    // running visitor-side widget somewhere — the standalone Live Preview
    // tab, or the in-canvas Preview popup — that has no other way to learn
    // an agent just replied. Writing this message into the same persisted
    // store those surfaces already read/write lets WebChatFlowBuilder.jsx's
    // useAgentReplyBridge (listening for `storage` events on this key)
    // pick it up and inject it into that live session, so the reply
    // actually reaches "the visitor" instead of only ever landing in the
    // Inbox's own record of the conversation.
    if (conversationId.startsWith('flowtest_')) {
      try {
        const store = JSON.parse(localStorage.getItem(FLOW_TEST_STORE_KEY) || '{}')
        const conv = store[conversationId]
        if (conv) {
          store[conversationId] = { ...conv, messages: [...conv.messages, newMsg], lastMessage: text, timestamp: new Date().toISOString() }
          localStorage.setItem(FLOW_TEST_STORE_KEY, JSON.stringify(store))
        }
      } catch {}
    }
  }

  function takeoverConversation(id) {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'agent', agentId: 'admin', agentName: 'Deepak Kumar' } : c)
    )
  }

  function resolveConversation(id) {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'resolved', unread: 0 } : c)
    )
  }

  function returnToBot(id) {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'bot', agentId: null, agentName: null } : c)
    )
  }

  function assignAgent(conversationId, agentId, agentName) {
    setConversations(prev =>
      prev.map(c => c.id === conversationId
        ? { ...c, status: 'agent', agentId, agentName }
        : c
      )
    )
  }

  function toggleStar(id) {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c))
  }

  function archiveConversation(id) {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c))
  }

  function snoozeConversation(id, until) {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, snoozed: until } : c))
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
    setConversations(prev => prev.map(c =>
      c.id === id && !c.labels?.includes(label)
        ? { ...c, labels: [...(c.labels || []), label] }
        : c
    ))
  }

  function removeLabel(id, label) {
    setConversations(prev => prev.map(c =>
      c.id === id
        ? { ...c, labels: (c.labels || []).filter(l => l !== label) }
        : c
    ))
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
