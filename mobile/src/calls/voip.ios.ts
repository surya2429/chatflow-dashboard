import VoipPushNotification from 'react-native-voip-push-notification'
import { rememberIncoming } from './pendingCall'

/**
 * iOS PushKit. Registration happens natively at launch (plugins/withVoipPush.js);
 * here we receive the token and the payloads. The CallKit report for an
 * incoming push has already been made in native code by the time this runs —
 * JS only records which conversation the call belongs to so that answering it
 * (possibly from the lock screen, possibly from a cold start) knows where to go.
 */
type Payload = { callId?: string; conversationId?: string; callerName?: string; video?: string }

let token: string | null = null
const tokenListeners = new Set<(t: string) => void>()
let wired = false

function onPayload(p: Payload) {
  if (p.callId && p.conversationId) {
    void rememberIncoming({ callId: p.callId, conversationId: p.conversationId, callerName: p.callerName ?? 'Website visitor', video: p.video === 'true' })
    VoipPushNotification.onVoipNotificationCompleted(p.callId)
  }
}

export function wireVoip() {
  if (wired) return
  wired = true
  VoipPushNotification.addEventListener('register', (t) => {
    token = t
    for (const l of tokenListeners) l(t)
  })
  VoipPushNotification.addEventListener('notification', (p) => onPayload(p as Payload))
  // Events that fired before the JS bridge was up (a push that launched the app).
  VoipPushNotification.addEventListener('didLoadWithEvents', (events) => {
    for (const e of events ?? []) {
      if (e.name === VoipPushNotification.RNVoipPushRemoteNotificationsRegisteredEvent) {
        token = e.data as string
        for (const l of tokenListeners) l(token)
      } else if (e.name === VoipPushNotification.RNVoipPushRemoteNotificationReceivedEvent) {
        onPayload(e.data as Payload)
      }
    }
  })
  VoipPushNotification.registerVoipToken()
}

export function onVoipToken(fn: (t: string) => void): () => void {
  wireVoip()
  tokenListeners.add(fn)
  if (token) fn(token)
  return () => tokenListeners.delete(fn)
}
