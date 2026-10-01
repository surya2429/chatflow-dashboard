import * as SecureStore from 'expo-secure-store'

/**
 * Tokens live in the iOS Keychain / Android Keystore-backed storage.
 * AFTER_FIRST_UNLOCK so a push arriving while the phone is locked (an
 * incoming call) can still read the refresh token to authenticate.
 */
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }

export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key, OPTS),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, OPTS),
  remove: (key: string) => SecureStore.deleteItemAsync(key, OPTS),
}
