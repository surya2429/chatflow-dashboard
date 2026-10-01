/**
 * PushKit exists only on iOS (voip.ios.ts). Android rings through a
 * high-priority FCM data message handled in src/background.ts; web has no
 * push at all.
 */
export function wireVoip() {}
export function onVoipToken(_fn: (t: string) => void): () => void { return () => {} }
