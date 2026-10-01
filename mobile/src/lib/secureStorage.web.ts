/**
 * Web build (used for UI development in a browser only): there is no Keychain,
 * so this falls back to localStorage. The shipped apps are iOS/Android and use
 * secureStorage.ts.
 */
function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

export const secureStorage = {
  get: async (key: string) => safe(() => localStorage.getItem(key), null),
  set: async (key: string, value: string) => { safe(() => localStorage.setItem(key, value), undefined) },
  remove: async (key: string) => { safe(() => localStorage.removeItem(key), undefined) },
}
