/**
 * Web build (UI development only): no FCM/APNs. The live SSE stream still
 * delivers everything while the tab is open.
 */
export type PushData = {
  kind?: 'message' | 'assignment' | 'waiting' | 'call' | 'call_cancelled'
  conversationId?: string
  callId?: string
  video?: string
  callerName?: string
}

export function configureForegroundPresentation() {}
export async function registerForPush(): Promise<boolean> { return false }
export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable'
export async function notificationStatus(): Promise<NotificationStatus> { return 'unavailable' }
export function watchPushTokens(): () => void { return () => {} }
export function watchNotificationTaps(_open: (data: PushData) => void): () => void { return () => {} }
export async function dismissFor(_conversationId: string) {}
