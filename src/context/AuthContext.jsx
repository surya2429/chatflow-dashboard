import { createContext, useContext, useState } from 'react'
import { ALL_NAV_ITEMS } from '../constants/navigation'

const AuthContext = createContext(null)

/* ── Role definitions ─────────────────────────────────────────── */
const ROLE_NAV = {
  admin:      null, // null = all items
  supervisor: [
    'home', 'conversations', 'contacts', 'broadcasting', 'analytics', 'settings',
    'ig-inbox', 'ig-contacts', 'ig-broadcasts', 'ig-automations', 'ig-analytics',
    'wc-inbox', 'wc-contacts', 'wc-automation', 'wc-analytics',
    'integrations',
  ],
  agent: [
    'conversations', 'contacts', 'settings',
    'ig-inbox', 'ig-contacts',
    'wc-inbox', 'wc-contacts',
  ],
}

export const DEMO_USERS = [
  {
    role:     'admin',
    roleLabel:'Admin',
    name:     'Deepak Kumar',
    email:    'admin@acmecorp.com',
    password: 'admin123',
    initials: 'DK',
    color:    '#0066ff',
    desc:     'Full platform access — manage bots, analytics, billing & team',
    workspace:{ name: 'Acme Corp', plan: 'Pro' },
    creditBalance: 4250,
  },
  {
    role:     'supervisor',
    roleLabel:'Supervisor',
    name:     'Priya Das',
    email:    'priya@acmecorp.com',
    password: 'super123',
    initials: 'PD',
    color:    '#8B5CF6',
    desc:     'Team oversight — analytics, broadcasts & conversation management',
    workspace:{ name: 'Acme Corp', plan: 'Pro' },
    creditBalance: 0,
  },
  {
    role:     'agent',
    roleLabel:'Agent',
    name:     'Rahul Mehta',
    email:    'rahul@acmecorp.com',
    password: 'agent123',
    initials: 'RM',
    color:    '#22C55E',
    desc:     'Handle conversations & manage contacts',
    workspace:{ name: 'Acme Corp', plan: 'Pro' },
    creditBalance: 0,
  },
]

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)

  /* whether the logged-in role can see a given nav item id */
  function canAccessNavId(id) {
    if (!currentUser) return false
    const allowed = ROLE_NAV[currentUser.role]
    return allowed === null || allowed.includes(id)
  }

  /* legacy flat allowedNav (kept for any remaining consumers) */
  const allowedNav = currentUser
    ? ROLE_NAV[currentUser.role] === null
      ? ALL_NAV_ITEMS
      : ALL_NAV_ITEMS.filter(item => ROLE_NAV[currentUser.role].includes(item.id))
    : []

  function login(email, password) {
    const found = DEMO_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) return { ok: false, error: 'Invalid email or password.' }
    setCurrentUser(found)
    return { ok: true }
  }

  function loginAs(user) {
    setCurrentUser(user)
  }

  function logout() {
    setCurrentUser(null)
  }

  /* The plan shown in the sidebar/top bar and used for gating. Billing is the
     source of truth, so it pushes the plan name here after it loads or changes. */
  function setWorkspacePlan(plan) {
    setCurrentUser(u => (!u || u.workspace?.plan === plan ? u : { ...u, workspace: { ...u.workspace, plan } }))
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      allowedNav,
      canAccessNavId,
      login,
      loginAs,
      logout,
      setWorkspacePlan,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
