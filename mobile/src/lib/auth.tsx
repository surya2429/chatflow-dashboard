import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { getDeviceId } from './device'
import { onLiveEvent, startLive, stopLive } from './live'
import { startPresence, stopPresence } from './presence'
import { currentUser, onSessionChange, restore, signOut as endSession } from './session'
import { store } from './store'
import type { User } from './types'
import { registerForPush, watchPushTokens } from '@/push/push'

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: User }

interface AuthApi {
  state: AuthState
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

const Ctx = createContext<AuthApi | null>(null)

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}

/** The signed-in user, for screens that only render when signed in. */
export function useUser(): User {
  const { state } = useAuth()
  if (state.status !== 'signedIn') throw new Error('useUser outside a signed-in screen')
  return state.user
}

/**
 * Session lifecycle. Everything that needs a signed-in user — the live
 * stream, the presence heartbeat, push registration, the team list — starts
 * here on sign-in and stops on sign-out, so no screen has to remember to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })

  useEffect(() => onSessionChange((user) => {
    setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null })
  }), [])

  useEffect(() => {
    restore()
      .then((user) => setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null }))
      .catch(() => {
        // Offline at launch with a cached session: show the cached inbox;
        // requests retry once the network is back.
        const user = currentUser()
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null })
      })
  }, [])

  const signedInId = state.status === 'signedIn' ? state.user.id : null
  useEffect(() => {
    if (!signedInId) return undefined
    store.setActiveUser(signedInId)
    startLive()
    startPresence()
    void registerForPush()
    const unwatch = watchPushTokens()
    api.team().then(r => store.setTeam(r.items)).catch(() => {})
    // Bot cards show live counts: refresh them shortly after conversation
    // activity, coalescing bursts into one request.
    const loadBots = () => api.bots().then(r => store.setBots(r.items)).catch(() => {})
    void loadBots()
    let botTimer: ReturnType<typeof setTimeout> | null = null
    const unlisten = onLiveEvent((ev) => {
      if (ev.kind === 'presence.updated') return
      if (botTimer) clearTimeout(botTimer)
      botTimer = setTimeout(loadBots, 1200)
    })
    return () => {
      unlisten()
      if (botTimer) clearTimeout(botTimer)
      unwatch()
      stopLive()
      stopPresence()
      store.reset()
    }
  }, [signedInId])

  const signIn = useCallback(async (email: string, password: string) => {
    await api.login(email.trim(), password, await getDeviceId())
  }, [])

  const signOut = useCallback(async () => {
    await endSession()
  }, [])

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
