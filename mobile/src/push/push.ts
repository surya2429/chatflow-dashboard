import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { api } from '@/lib/api'
import { appVersion, getDeviceId } from '@/lib/device'
import { getState } from '@/lib/store'
import { onVoipToken } from '@/calls/voip'

/**
 * Push notifications — the background half of live updates.
 *
 * Tokens: the NATIVE device token (FCM on Android, APNs on iOS), not an Expo
 * push token — agent-api talks to FCM/APNs directly (src/push there). iOS
 * additionally registers a PushKit VoIP token for incoming calls.
 *
 * Routing a tap: every push carries `conversationId`; tapping opens that
 * conversation, including from a cold start (app killed).
 */
export type PushData = {
  kind?: 'message' | 'assignment' | 'waiting' | 'call' | 'call_cancelled'
  conversationId?: string
  callId?: string
  video?: string
  callerName?: string
  title?: string
  body?: string
}

let pushToken: string | null = null
let voipToken: string | null = null

export function configureForegroundPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = n.request.content.data as PushData
      // Calls have their own full-screen UI; a message for the chat already
      // on screen would just be noise.
      const suppress = data.kind === 'call' || data.kind === 'call_cancelled' ||
        (!!data.conversationId && data.conversationId === getState().activeConversationId)
      return { shouldShowBanner: !suppress, shouldShowList: !suppress, shouldPlaySound: !suppress, shouldSetBadge: false }
    },
  })
}

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return
  // Channel ids match what agent-api sets on FCM messages (src/push/fcm.ts).
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Customer messages', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200],
  })
  await Notifications.setNotificationChannelAsync('assignments', {
    name: 'New assignments', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 300, 150, 300],
  })
}

async function sendRegistration() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return
  await api.registerDevice({
    deviceId: await getDeviceId(),
    platform: Platform.OS,
    pushToken,
    voipToken,
    appVersion,
  }).catch(() => { /* retried on next launch / token change */ })
}

/**
 * Asks permission (once — the OS remembers the answer), fetches tokens and
 * registers this device for the signed-in user. Safe to call on every launch.
 * Returns whether notifications are permitted.
 */
export async function registerForPush(): Promise<boolean> {
  if (!Device.isDevice) return false // simulators can't receive remote pushes
  await ensureAndroidChannels()
  const existing = await Notifications.getPermissionsAsync()
  const status = existing.granted ? existing : await Notifications.requestPermissionsAsync()
  if (!status.granted) return false
  try {
    pushToken = (await Notifications.getDevicePushTokenAsync()).data as string
  } catch {
    pushToken = null // e.g. Android build without google-services.json
  }
  await sendRegistration()
  return true
}

export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable'

/** Whether this device will show notifications (denied = only Settings can change it). */
export async function notificationStatus(): Promise<NotificationStatus> {
  if (!Device.isDevice) return 'unavailable'
  const p = await Notifications.getPermissionsAsync()
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'
}

/** Keeps the server's copy of our tokens current for the app's lifetime. */
export function watchPushTokens(): () => void {
  const sub = Notifications.addPushTokenListener((t) => {
    pushToken = t.data as string
    void sendRegistration()
  })
  const unVoip = onVoipToken((t) => {
    voipToken = t
    void sendRegistration()
  })
  return () => { sub.remove(); unVoip() }
}

/**
 * Taps on notifications → conversation. `open` is called once the router is
 * ready; for a cold start it receives the notification that launched the app.
 */
export function watchNotificationTaps(open: (data: PushData) => void): () => void {
  const initial = Notifications.getLastNotificationResponse()
  if (initial) open(initial.notification.request.content.data as PushData)
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    open(r.notification.request.content.data as PushData)
  })
  return () => sub.remove()
}

/** Clears a chat's notifications from the tray once the agent opens it. */
export async function dismissFor(conversationId: string) {
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => [])
  await Promise.all(shown
    .filter(n => (n.request.content.data as PushData)?.conversationId === conversationId)
    .map(n => Notifications.dismissNotificationAsync(n.request.identifier)))
}
