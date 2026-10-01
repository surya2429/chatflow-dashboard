import { randomUUID } from 'expo-crypto'
import { Platform } from 'react-native'
import * as Application from 'expo-application'
import { secureStorage } from './secureStorage'

/**
 * A stable id for this installation. The server keys push registrations and
 * sessions on it, so signing out on this phone unregisters exactly this
 * phone, and a phone that changes hands moves to its new user.
 */
const KEY = 'chatflow.deviceId'
let cached: string | null = null

export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  const stored = await secureStorage.get(KEY)
  cached = stored ?? `${Platform.OS}-${randomUUID()}`
  if (!stored) await secureStorage.set(KEY, cached)
  return cached
}

export const appVersion = Application.nativeApplicationVersion ?? '1.0.0'
