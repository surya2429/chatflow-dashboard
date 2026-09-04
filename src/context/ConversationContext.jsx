import { createContext, useContext, useState } from 'react'
import { CONVERSATIONS } from '../constants/mockData'

const ConversationContext = createContext(null)

export function ConversationProvider({ children }) {
  const [conversations, setConversations] = useState(CONVERSATIONS)
  const [activeId, setActiveId] = useState(null)
  const [filter, setFilter] = useState('all')           // all | open | pending | bot | agent | resolved | closed
  const [agentFilter, setAgentFilter] = useState('all') // all | unassigned | admin | a1 | a2 | ...
  const [sourceFilter, setSourceFilter] = useState('all') // all | direct | ctwa | g-ctwa | t-ctwa | broadcast
  const [channelFilter, setChannelFilter] = useState('all') // all | whatsapp | calls
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
    // default channel for conversations without explicit channel field is 'whatsapp'
    const matchChannel = channelFilter === 'all' || (c.channel || 'whatsapp') === channelFilter
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
      allConversations: conversations,
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
