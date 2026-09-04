import { createContext, useContext, useState } from 'react'
import { useAuth } from './AuthContext'
import { PRODUCTS } from '../constants/navigation'
import { DEFAULT_CUSTOM_FIELDS } from '../constants/customFieldDefs'

const AppContext = createContext(null)

export const BOTS = [
  {
    id: 'bot_1',
    name: 'Support Bot',
    number: '+91 98765 43210',
    numberName: 'Acme Support',
    status: 'active',
    color: '#0066ff',
    bg: '#eff4ff',
    avatar: 'SB',
    connectedAt: 'Jan 12, 2026',
    flows: 12,
    contacts: 1284,
    agents: 6,
    agentsOnline: 3,
    stats: {
      openConvs: 43, resolvedToday: 218, botActive: 18,
      messagesSent: 24821, deliveryRate: 98.2,
      botRate: 72, avgReply: '3.2m', csat: 4.6,
      newContacts: 34,
    },
  },
  {
    id: 'bot_2',
    name: 'Sales Bot',
    number: '+91 87654 32109',
    numberName: 'Acme Sales',
    status: 'active',
    color: '#10b981',
    bg: '#f0fdf4',
    avatar: 'SL',
    connectedAt: 'Feb 5, 2026',
    flows: 8,
    contacts: 892,
    agents: 4,
    agentsOnline: 2,
    stats: {
      openConvs: 27, resolvedToday: 143, botActive: 11,
      messagesSent: 15430, deliveryRate: 97.8,
      botRate: 65, avgReply: '4.1m', csat: 4.4,
      newContacts: 19,
    },
  },
  {
    id: 'bot_3',
    name: 'E-commerce Bot',
    number: '+91 76543 21098',
    numberName: 'Acme Shop',
    status: 'paused',
    color: '#f59e0b',
    bg: '#fffbeb',
    avatar: 'EC',
    connectedAt: 'Mar 1, 2026',
    flows: 5,
    contacts: 456,
    agents: 2,
    agentsOnline: 0,
    stats: {
      openConvs: 0, resolvedToday: 89, botActive: 0,
      messagesSent: 8920, deliveryRate: 96.1,
      botRate: 58, avgReply: '6.8m', csat: 4.1,
      newContacts: 0,
    },
  },
  {
    id: 'bot_4',
    name: 'Onboarding Bot',
    number: '+91 65432 10987',
    numberName: 'Acme Onboard',
    status: 'disconnected',
    color: '#64748b',
    bg: '#f8fafc',
    avatar: 'OB',
    connectedAt: null,
    flows: 3,
    contacts: 0,
    agents: 1,
    agentsOnline: 0,
    stats: {
      openConvs: 0, resolvedToday: 0, botActive: 0,
      messagesSent: 0, deliveryRate: 0,
      botRate: 0, avgReply: '—', csat: 0,
      newContacts: 0,
    },
  },
]

export function AppProvider({ children }) {
  const { currentUser } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeBotId, setActiveBotId] = useState('bot_1')
  const [bots, setBots] = useState(BOTS)
  const [activeProductId, setActiveProductId] = useState('whatsapp')
  const [customFields, setCustomFields] = useState(DEFAULT_CUSTOM_FIELDS)
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Campaign "Flash Sale" sent to 1,204 contacts', time: '2 min ago', read: false },
    { id: 2, text: 'New lead: Rahul Mehta from WhatsApp', time: '14 min ago', read: false },
    { id: 3, text: 'Shopify integration connected', time: '1 hr ago', read: true },
    { id: 4, text: 'Voice bot handled 12 calls today', time: '3 hr ago', read: true },
  ])

  const user = currentUser
    ? {
        name:          currentUser.name,
        email:         currentUser.email,
        initials:      currentUser.initials,
        role:          currentUser.roleLabel,
        workspace:     currentUser.workspace,
        creditBalance: currentUser.creditBalance,
      }
    : {
        name: '', email: '', initials: '?', role: '',
        workspace: { name: '', plan: '' }, creditBalance: 0,
      }

  const activeBot = bots.find(b => b.id === activeBotId) || bots[0]
  const activeProduct = PRODUCTS.find(p => p.id === activeProductId) || PRODUCTS[0]
  const unreadCount = notifications.filter(n => !n.read).length

  function toggleSidebar() { setSidebarCollapsed(prev => !prev) }
  function toggleMobileMenu() { setMobileMenuOpen(prev => !prev) }
  function closeMobileMenu() { setMobileMenuOpen(false) }
  function markAllRead() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }
  function addBot(bot) { setBots(prev => [...prev, { ...bot, id: 'bot_' + Date.now(), stats: { openConvs:0, resolvedToday:0, botActive:0, messagesSent:0, deliveryRate:0, botRate:0, avgReply:'—', csat:0, newContacts:0 } }]) }
  function updateBotStatus(id, status) { setBots(prev => prev.map(b => b.id === id ? { ...b, status } : b)) }

  function addCustomField(scope, field) {
    setCustomFields(prev => ({ ...prev, [scope]: [...prev[scope], field] }))
  }
  function removeCustomField(scope, id) {
    setCustomFields(prev => ({ ...prev, [scope]: prev[scope].filter(f => f.id !== id) }))
  }

  return (
    <AppContext.Provider value={{
      user, bots, activeBot, activeBotId, setActiveBotId, addBot, updateBotStatus,
      products: PRODUCTS, activeProduct, activeProductId, setActiveProductId,
      customFields, addCustomField, removeCustomField,
      sidebarCollapsed, toggleSidebar,
      mobileMenuOpen, toggleMobileMenu, closeMobileMenu,
      notifications, unreadCount, markAllRead,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
