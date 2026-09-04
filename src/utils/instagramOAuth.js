/* ─── Instagram API with Instagram Login ("Business Login") ─────────────────
   https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login

   The authorize step needs no secret and can be built entirely client-side.
   The `code` it returns is single-use and only redeemable server-side (the
   exchange calls require the app secret) — see backend/src/instagram/. */

export const INSTAGRAM_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'

/** Scopes this app requests — matches Meta's current (post Jan-2025) naming. */
export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
]

const APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID || '506519711888315'
const REDIRECT_URI = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || 'https://www.feltso.com/instagramBusinessLoginSetup'

const STATE_STORAGE_KEY = 'ig_oauth_state'

function randomState() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Builds the Meta authorize URL and stashes a CSRF `state` value in
 * sessionStorage so the callback page can verify the redirect wasn't forged.
 * `forceReauth` maps to Meta's `force_reauth` param (re-prompt Instagram
 * credentials even if the browser already has a session).
 */
export function buildInstagramAuthorizeUrl({ forceReauth = false } = {}) {
  const state = randomState()
  sessionStorage.setItem(STATE_STORAGE_KEY, state)

  const params = new URLSearchParams({
    force_reauth: String(forceReauth),
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: INSTAGRAM_OAUTH_SCOPES.join(','),
    state,
  })
  return `${INSTAGRAM_AUTHORIZE_URL}?${params.toString()}`
}

/** Redirects the browser to Instagram's consent screen. */
export function startInstagramOAuth(options) {
  window.location.href = buildInstagramAuthorizeUrl(options)
}

/** Reads `code` / `error` / `state` off the callback URL's query string. */
export function parseInstagramOAuthCallback(search) {
  const params = new URLSearchParams(search)
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorReason: params.get('error_reason'),
    errorDescription: params.get('error_description'),
  }
}

/** True only if `state` matches the value this browser tab generated before redirecting out. */
export function verifyInstagramOAuthState(state) {
  const expected = sessionStorage.getItem(STATE_STORAGE_KEY)
  sessionStorage.removeItem(STATE_STORAGE_KEY)
  return !!expected && expected === state
}
