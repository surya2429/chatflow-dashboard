/* Facebook's JavaScript SDK and the "Connect with Facebook" popup (Facebook Login for Business / Embedded Signup).
   The popup returns a one-time code (valid ~30 seconds) that the server swaps for the customer's token; the page
   never sees a token or the app secret. */

let sdk = null

/** Load the SDK once and resolve with window.FB. Call it ahead of time (on page load): FB.login must run straight
    from a click, or the browser blocks the popup. */
export function loadFacebookSdk({ appId, version }) {
  if (sdk) return sdk
  sdk = new Promise((resolve, reject) => {
    if (window.FB) { window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version }); return resolve(window.FB) }
    window.fbAsyncInit = () => { window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version }); resolve(window.FB) }
    const s = document.createElement('script')
    s.src = 'https://connect.facebook.net/en_US/sdk.js'
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous'
    s.onerror = () => { sdk = null; reject(new Error('Could not load Facebook. Check your connection or ad blocker and try again.')) }
    document.head.appendChild(s)
  })
  return sdk
}

/** Open the popup. Resolves { code, session } — session holds the asset ids the popup reports (ad accounts, Pages,
    WhatsApp account, dataset); the server re-checks every one of them. Rejects with { cancelled: true } if closed. */
export function loginWithFacebook(FB, configId) {
  return new Promise((resolve, reject) => {
    let session = {}
    const onMessage = (e) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return
      try {
        const m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (m?.type === 'WA_EMBEDDED_SIGNUP' && m.data && typeof m.data === 'object') session = { ...session, ...m.data }
      } catch { /* not ours */ }
    }
    window.addEventListener('message', onMessage)
    const done = (fn, v) => { window.removeEventListener('message', onMessage); fn(v) }
    FB.login((response) => {
      const code = response?.authResponse?.code
      if (!code) return done(reject, Object.assign(new Error('The Facebook window was closed before finishing.'), { cancelled: true }))
      setTimeout(() => done(resolve, { code, session }), 400)       // the popup's asset-ids message can land just after the callback
    }, { config_id: configId, response_type: 'code', override_default_response_type: true, extras: { setup: {} } })
  })
}
