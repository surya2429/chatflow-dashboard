import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useData } from './DataContext'
import { can } from '../lib/domain'

const KEY = 'pnl.session.v1'
const AuthCtx = createContext(null)

const readSession = () => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/**
 * Three levels of access behind one sign-in form.
 *
 * Staff hold a role — a Super Administrator with complete control, or an Administration
 * User restricted to assigned modules. Customers sign in to their own portal instead, and
 * never touch an admin route. The signed-in principal is stored by id, so permission edits
 * made in User Management take effect for that session immediately.
 */
export function AuthProvider({ children }) {
  const { db } = useData()
  const [session, setSession] = useState(readSession)
  const [error, setError] = useState('')

  const user = useMemo(
    () => (session && session.kind === 'staff' ? db.users.find((u) => u.id === session.id) || null : null),
    [db.users, session]
  )
  const customer = useMemo(
    () => (session && session.kind === 'customer' ? db.customers.find((c) => c.id === session.id) || null : null),
    [db.customers, session]
  )

  useEffect(() => {
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session))
      else localStorage.removeItem(KEY)
    } catch { /* private mode */ }
  }, [session])

  // An account removed or suspended while signed in loses the session on the next render.
  useEffect(() => {
    if (!session) return
    const principal = session.kind === 'staff' ? user : customer
    if (!principal || principal.status !== 'active') setSession(null)
  }, [session, user, customer])

  const value = useMemo(() => ({
    user,
    customer,
    principal: user || customer,
    isCustomer: !!customer,
    isStaff: !!user,
    isSuper: user ? user.role === 'super_admin' : false,
    error,

    /**
     * Matches staff first, then customers — one form, and the portal a person lands on
     * follows from the account they signed in with.
     */
    signIn: (email, password) => {
      const term = String(email).trim().toLowerCase()
      const staff = db.users.find((u) => u.email.toLowerCase() === term)
      const cust = db.customers.find((c) => c.email.toLowerCase() === term)
      const found = staff || cust
      if (!found) { setError('No account found for that email address.'); return false }
      if (found.status !== 'active') {
        setError(staff
          ? 'This account has been suspended. Contact a Super Administrator.'
          : 'Your account is not active yet. Our team will approve it shortly.')
        return false
      }
      if (password !== found.password) { setError('Incorrect password.'); return false }
      setError('')
      setSession({ kind: staff ? 'staff' : 'customer', id: found.id })
      return true
    },

    signOut: () => { setSession(null); setError('') },
    clearError: () => setError(''),
    can: (moduleId) => can(user, moduleId),
  }), [db.users, db.customers, user, customer, error])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
