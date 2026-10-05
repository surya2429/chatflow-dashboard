/* ─── Products — the top-level "which channel am I working in" switcher ── */
export const PRODUCTS = [
  { id: 'whatsapp',  name: 'WhatsApp',      short: 'WhatsApp',   tagline: 'Business messaging',      icon: 'MessageSquare', color: '#25D366' },
  { id: 'instagram', name: 'Instagram',     short: 'Instagram',  tagline: 'DMs, comments & stories', icon: 'Instagram',     color: '#E1306C' },
  { id: 'webchat',   name: 'Website Chat',  short: 'Web Chat',   tagline: 'Live chat widget',        icon: 'Globe',         color: '#0066ff' },
]

/* ─── Per-product nav — Inbox / Contacts / Automation / Analytics etc ──── */
export const PRODUCT_NAV_ITEMS = {
  whatsapp: [
    { id: 'conversations', label: 'Inbox',       icon: 'MessageSquare', path: '/conversations', badge: '12', badgeColor: 'blue' },
    { id: 'contacts',      label: 'Contacts',     icon: 'Users',         path: '/contacts' },
    { id: 'broadcasting',  label: 'Broadcasts',   icon: 'Radio',         path: '/broadcasting' },
    { id: 'flows',         label: 'Automation',   icon: 'Workflow',      path: '/flows' },
    { id: 'catalog',       label: 'Catalog',      icon: 'ShoppingBag',   path: '/catalog' },
    { id: 'analytics',     label: 'Analytics',    icon: 'BarChart2',     path: '/analytics' },
  ],
  instagram: [
    { id: 'ig-inbox',       label: 'Inbox',        icon: 'MessageSquare', path: '/instagram/inbox' },
    { id: 'ig-contacts',    label: 'Contacts',     icon: 'Users',         path: '/instagram/contacts' },
    { id: 'ig-broadcasts',  label: 'Broadcasts',   icon: 'Radio',         path: '/instagram/broadcasts' },
    { id: 'ig-automations', label: 'Automations',  icon: 'Workflow',      path: '/instagram/automations' },
    { id: 'ig-analytics',   label: 'Analytics',    icon: 'BarChart2',     path: '/instagram' },
  ],
  webchat: [
    { id: 'wc-inbox',      label: 'Inbox',        icon: 'MessageSquare', path: '/webchat/inbox' },
    { id: 'wc-contacts',   label: 'Contacts',     icon: 'Users',         path: '/webchat/contacts' },
    { id: 'wc-appearance', label: 'Appearance',   icon: 'Palette',       path: '/webchat/appearance' },
    { id: 'wc-automation', label: 'Automation',   icon: 'Workflow',      path: '/webchat' },
    { id: 'wc-analytics',  label: 'Analytics',    icon: 'BarChart2',     path: '/webchat/analytics' },
  ],
}

/* ─── Always first, above every product's own nav — workspace-level "home" ── */
export const HOME_NAV_ITEM = { id: 'home', label: 'My Bots', icon: 'Layers', path: '/' }

/* ─── Shown after the active product's nav, same order for every product ── */
export const COMMON_NAV_ITEMS = [
  { id: 'integrations', label: 'Integrations',  icon: 'Puzzle',       path: '/integrations', badge: '45+', badgeColor: 'green' },
  { id: 'voice',        label: 'Voice Bot',     icon: 'PhoneCall',    path: '/voice', badge: 'NEW', badgeColor: 'purple' },
  { id: 'shopify',      label: 'Shopify',       icon: 'ShoppingCart', path: '/shopify', badge: 'NEW', badgeColor: 'green' },
  { id: 'installation', label: 'Installation',  icon: 'Puzzle',       path: '/installation', dividerBefore: true },
  { id: 'settings',     label: 'Settings',      icon: 'Settings',     path: '/settings' },
]

/** Common-nav item ids to hide while a given product is active — e.g. Voice Bot has no Instagram or Website Chat equivalent. */
export const PRODUCT_HIDDEN_COMMON_IDS = {
  instagram: ['voice'],
  webchat: ['voice'],
}

/** Flat list of every nav item across every product — used by role-based access checks that don't care which product is active. */
export const ALL_NAV_ITEMS = [
  HOME_NAV_ITEM,
  ...Object.values(PRODUCT_NAV_ITEMS).flat(),
  ...COMMON_NAV_ITEMS,
]
