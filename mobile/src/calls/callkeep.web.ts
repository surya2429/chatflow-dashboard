/** Web build: no OS call UI — the in-app call screen is the whole experience. */
export function ensureCallKeep(): Promise<boolean> { return Promise.resolve(false) }
export async function displayIncoming(_callId: string, _callerName: string, _video: boolean) {}
export async function startOutgoing(_callId: string, _name: string, _video: boolean) {}
export function reportConnected(_callId: string, _direction: 'inbound' | 'outbound') {}
export function endNative(_callId: string) {}
export function setNativeMuted(_callId: string, _muted: boolean) {}
export function setSpeaker(_callId: string, _on: boolean) {}
export interface NativeCallHandlers {
  onAnswer(callId: string): void
  onEnd(callId: string): void
  onMute(callId: string, muted: boolean): void
}
export function listenNativeCalls(_h: NativeCallHandlers): () => void { return () => {} }
export const nativeCallUiAvailable = false
