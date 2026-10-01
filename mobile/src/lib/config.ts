import Constants from 'expo-constants'

const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl

/** agent-api base URL, e.g. https://agent-api.example.com (no trailing slash). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? fromConfig ?? 'http://localhost:8090').replace(/\/$/, '')

/** Signaling endpoint on the same host: https → wss, http → ws. */
export const SIGNAL_URL = `${API_URL.replace(/^http/, 'ws')}/signal`
