import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { displayIncoming, endNative } from './calls/callkeep'
import { clearPending, rememberIncoming } from './calls/pendingCall'

/**
 * Runs for pushes received while the app is backgrounded or killed —
 * on Android, in a headless JS context with no UI.
 *
 * Its one job is calls on Android: agent-api sends incoming calls as
 * high-priority DATA-ONLY FCM messages (no notification block), which the OS
 * hands to this task instead of drawing a notification. We raise the
 * ConnectionService incoming-call screen, which rings full-screen even on a
 * locked phone. (iOS does the equivalent natively from PushKit — see
 * plugins/withVoipPush.js.)
 *
 * Message and assignment pushes carry a notification block and are displayed
 * by the OS; nothing to do here.
 *
 * Must be imported from the entry file (index.ts) so the task is defined
 * before any headless invocation.
 */
export const BACKGROUND_NOTIFICATION_TASK = 'chatflow-background-notification'

type Data = { kind?: string; callId?: string; conversationId?: string; callerName?: string; video?: string }

/** The payload's position varies by platform and message type — find the object carrying `kind`. */
function extract(raw: unknown): Data | null {
  const seen: unknown[] = [raw]
  while (seen.length) {
    const v = seen.shift()
    if (typeof v === 'string') {
      try { seen.push(JSON.parse(v)) } catch { /* not JSON */ }
      continue
    }
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    if (typeof o.kind === 'string') return o as Data
    seen.push(o.data, o.dataString, o.body, o.notification, (o.request as Record<string, unknown> | undefined)?.content)
  }
  return null
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<unknown>(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) return
    const d = extract(data)
    if (!d?.callId) return
    if (d.kind === 'call' && Platform.OS === 'android' && d.conversationId) {
      const callerName = d.callerName ?? 'Website visitor'
      await rememberIncoming({ callId: d.callId, conversationId: d.conversationId, callerName, video: d.video === 'true' })
      await displayIncoming(d.callId, callerName, d.video === 'true')
    } else if (d.kind === 'call_cancelled') {
      // Answered on another device, or the visitor gave up.
      endNative(d.callId)
      await clearPending(d.callId)
    }
  })

  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {
    // Not available in Expo Go / unsupported environments; foreground
    // delivery via the live stream still works.
  })
}
