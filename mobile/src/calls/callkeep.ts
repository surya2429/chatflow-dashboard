import { Platform } from 'react-native'
import RNCallKeep from 'react-native-callkeep'

/**
 * The OS call UI: CallKit on iOS, ConnectionService on Android. This is what
 * makes an incoming call ring full-screen on a locked phone, show in the
 * status bar during the call, and survive the app being backgrounded.
 *
 * The call id (a UUID from agent-api's call_sessions) is used as the
 * CallKit/ConnectionService UUID, so native and JS agree on which call is which.
 */
let setupPromise: Promise<boolean> | null = null

export function ensureCallKeep(): Promise<boolean> {
  setupPromise ??= RNCallKeep.setup({
    ios: { appName: 'ChatFlow', supportsVideo: true, maximumCallGroups: '1', maximumCallsPerCallGroup: '1', includesCallsInRecents: false },
    android: {
      alertTitle: 'Allow ChatFlow calls',
      alertDescription: 'ChatFlow needs phone-account access to show incoming customer calls on your lock screen.',
      cancelButton: 'Not now',
      okButton: 'Allow',
      additionalPermissions: [],
      // Self-managed: our own calls, not routed through the SIM dialer.
      selfManaged: true,
      foregroundService: {
        channelId: 'com.chatflow.agent.calls',
        channelName: 'Ongoing calls',
        notificationTitle: 'ChatFlow call in progress',
      },
    },
  }).then((ok) => {
    if (Platform.OS === 'android') RNCallKeep.setAvailable(true)
    return ok
  }).catch(() => false)
  return setupPromise
}

export async function displayIncoming(callId: string, callerName: string, video: boolean) {
  await ensureCallKeep()
  RNCallKeep.displayIncomingCall(callId, callerName, callerName, 'generic', video)
}

export async function startOutgoing(callId: string, name: string, video: boolean) {
  await ensureCallKeep()
  RNCallKeep.startCall(callId, name, name, 'generic', video)
}

export function reportConnected(callId: string, direction: 'inbound' | 'outbound') {
  if (direction === 'outbound' && Platform.OS === 'ios') RNCallKeep.reportConnectedOutgoingCallWithUUID(callId)
  if (Platform.OS === 'android') RNCallKeep.setCurrentCallActive(callId)
}

export function endNative(callId: string) {
  try { RNCallKeep.endCall(callId) } catch { /* not displayed natively */ }
}

export function setNativeMuted(callId: string, muted: boolean) {
  try { RNCallKeep.setMutedCall(callId, muted) } catch { /* ignore */ }
}

export function setSpeaker(callId: string, on: boolean) {
  try { RNCallKeep.toggleAudioRouteSpeaker(callId, on) } catch { /* ignore */ }
}

export interface NativeCallHandlers {
  onAnswer(callId: string): void
  onEnd(callId: string): void
  onMute(callId: string, muted: boolean): void
}

export function listenNativeCalls(h: NativeCallHandlers): () => void {
  void ensureCallKeep()
  const subs = [
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => h.onAnswer(callUUID)),
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => h.onEnd(callUUID)),
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', (e: { callUUID: string; muted: boolean }) => h.onMute(e.callUUID, e.muted)),
  ]
  // Actions taken before JS was listening (answered from the lock screen
  // while the app was still starting).
  void RNCallKeep.getInitialEvents().then((events) => {
    for (const e of events) {
      const data = e.data as { callUUID?: string } | undefined
      if (!data?.callUUID) continue
      if (e.name === 'RNCallKeepPerformAnswerCallAction') h.onAnswer(data.callUUID)
      if (e.name === 'RNCallKeepPerformEndCallAction') h.onEnd(data.callUUID)
    }
    RNCallKeep.clearInitialEvents()
  }).catch(() => {})
  return () => { for (const s of subs) s.remove() }
}

export const nativeCallUiAvailable = true
