/* ─── Subscription store ──────────────────────────────────────────────────
   One copy of "what plan is this workspace on", shared by Billing, the Home plan
   card and the sidebar badge, so a payment made in Billing updates all of them
   without a reload. A module-level store (not a context) keeps it usable from
   anywhere with useSyncExternalStore. */
import { useSyncExternalStore } from 'react'
import { billing } from './billingApi'

let state = { loading: true, error: null, sub: null, config: null, profile: null }
const listeners = new Set()

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export async function refreshSubscription() {
  try {
    const [config, sub, prof] = await Promise.all([billing.config(), billing.subscription(), billing.profile().catch(() => null)])
    set({ config, sub, profile: prof?.profile ?? null, loading: false, error: null })
  } catch (error) {
    // Keep whatever we already knew; just report that it may be out of date.
    set({ loading: false, error })
  }
}

export const setSubscription = (sub) => set({ sub, error: null })
export const setProfile = (profile) => set({ profile })

export function useSubscription() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => state,
  )
}

/* Statuses that mean "the customer currently has the plan". */
const LIVE = new Set(['active', 'authenticated', 'pending'])
export const isLive = (sub) => !!sub && LIVE.has(sub.status)

/* The plan name to show in the UI chrome. */
export const planLabel = (sub) => (isLive(sub) ? sub.planName : 'Free')
