import { useEffect, useRef } from 'react'
import type { ViewStyle } from 'react-native'

/**
 * Browser WebRTC behind the same surface as webrtc.ts, so the call flow can
 * be exercised end-to-end in a browser during development.
 */
export const RTCPeerConnection = globalThis.RTCPeerConnection
export const RTCIceCandidate = globalThis.RTCIceCandidate
export const RTCSessionDescription = globalThis.RTCSessionDescription
export type MediaStream = globalThis.MediaStream

export function getUserMedia(video: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false })
}

export function streamProps(stream: MediaStream | null): { stream?: MediaStream } {
  return stream ? { stream } : {}
}

export function switchCamera(_stream: MediaStream | null) {}

export function RTCView({ stream, style, mirror, objectFit, zOrder: _z }: {
  stream?: MediaStream
  style?: ViewStyle
  mirror?: boolean
  objectFit?: 'cover' | 'contain'
  zOrder?: number
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream ?? null }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={!!mirror} // the local preview is the mirrored one; never play our own mic back
      style={{ ...(style as object), objectFit: objectFit ?? 'cover', transform: mirror ? 'scaleX(-1)' : undefined, backgroundColor: '#000' }}
    />
  )
}
