import { useCallback, useEffect, useState } from 'react'
import { ctwa } from '../../lib/ctwaApi'
import { loadFacebookSdk, loginWithFacebook } from '../../lib/fbSdk'

/* The customer's Meta connection: whether it exists, which accounts were shared and chosen, and the actions to
   connect (Facebook popup), choose another account, or disconnect. `onChange` runs after anything that changes it,
   so the ads and leads on screen reload against the new account. */
export function useMetaConnection(onChange) {
  const [conn, setConn] = useState(null)
  const [busy, setBusy] = useState('')            // 'connect' | 'select' | 'disconnect' | ''
  const [error, setError] = useState('')
  const [sdkError, setSdkError] = useState('')

  const refresh = useCallback(() => ctwa.connection().then(setConn).catch((e) => { setConn({ config: { enabled: false }, connected: false, adAccounts: [], pages: [], wabas: [], selected: {} }); setError(e.message) }), [])
  useEffect(() => { refresh() }, [refresh])

  // load Facebook's SDK ahead of time: the popup must open straight from the click
  const cfg = conn?.config
  useEffect(() => {
    if (cfg?.enabled) loadFacebookSdk({ appId: cfg.appId, version: cfg.version }).catch((e) => setSdkError(e.message))
  }, [cfg?.enabled, cfg?.appId, cfg?.version])

  async function run(kind, fn) {
    setBusy(kind); setError('')
    try { setConn(await fn()); onChange?.() }
    catch (e) { if (!e.cancelled) setError(e.message) }
    finally { setBusy('') }
  }

  return {
    conn, busy, error: error || sdkError, clearError: () => { setError(''); setSdkError('') },
    canConnect: !!cfg?.enabled,
    connect: () => run('connect', async () => {
      const FB = await loadFacebookSdk({ appId: cfg.appId, version: cfg.version })
      const { code, session } = await loginWithFacebook(FB, cfg.configId)
      return ctwa.connect(code, session)
    }),
    select: (sel) => run('select', () => ctwa.selectAssets(sel)),
    disconnect: () => run('disconnect', () => ctwa.disconnect()),
  }
}
