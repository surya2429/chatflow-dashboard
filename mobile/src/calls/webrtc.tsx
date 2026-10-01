/**
 * Native WebRTC (react-native-webrtc). The web build uses webrtc.web.ts,
 * which wraps the browser's own implementation behind the same surface.
 */
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices, type MediaStream } from 'react-native-webrtc'

export { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView }
export type { MediaStream }

export function getUserMedia(video: boolean): Promise<MediaStream> {
  return mediaDevices.getUserMedia({
    audio: true,
    video: video ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false,
  }) as Promise<MediaStream>
}

/** RTCView takes a stream URL on native. */
export function streamProps(stream: MediaStream | null): { streamURL?: string } {
  return stream ? { streamURL: stream.toURL() } : {}
}

/** Front/back camera flip — native only. */
export function switchCamera(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0] as unknown as { _switchCamera?: () => void } | undefined
  track?._switchCamera?.()
}
