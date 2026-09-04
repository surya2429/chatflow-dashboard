import { useRef } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * useWebRTC — manages RTCPeerConnection for WhatsApp Business Calling.
 *
 * Real integration flow:
 *   Outbound: startCall() → get SDP offer → send to backend →
 *             backend POSTs to graph.facebook.com/v25.0/{phoneNumberId}/calls →
 *             Meta returns SDP answer → setRemoteAnswer(sdp)
 *
 *   Inbound:  webhook fires (status=ringing, includes SDP offer) →
 *             backend pushes to frontend via WebSocket/SSE →
 *             answerCall(remoteSdp) → get SDP answer → send to backend →
 *             backend POSTs to graph.facebook.com/v25.0/{phoneNumberId}/calls/{callId}/answer
 */
export function useWebRTC() {
  const pcRef           = useRef(null)
  const localStreamRef  = useRef(null)
  const remoteAudioRef  = useRef(null) // attach to <audio autoPlay ref={remoteAudioRef} />

  // ── Get microphone access ───────────────────────────────────────────────────
  async function getLocalStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      return stream
    } catch (err) {
      console.error('[WebRTC] Microphone access denied:', err)
      throw new Error('Microphone permission required for calls. Please allow access in your browser settings.')
    }
  }

  // ── Create peer connection ──────────────────────────────────────────────────
  function createPC() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        // Real: send to backend → relay to Meta RTC infrastructure
        console.log('[WebRTC] ICE candidate (relay to backend):', candidate.candidate)
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState)
    }

    pc.ontrack = ({ streams }) => {
      if (remoteAudioRef.current && streams[0]) {
        remoteAudioRef.current.srcObject = streams[0]
      }
    }

    return pc
  }

  // ── Outbound: create offer ──────────────────────────────────────────────────
  async function startCall() {
    const stream = await getLocalStream()
    const pc     = createPC()
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    console.log('[WebRTC] SDP Offer created (send to backend):', offer.sdp.substring(0, 80) + '…')
    return offer.sdp
  }

  // ── Inbound: create answer from remote offer ────────────────────────────────
  async function answerCall(remoteSdp) {
    const stream = await getLocalStream()
    const pc     = createPC()
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    await pc.setRemoteDescription({ type: 'offer', sdp: remoteSdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    console.log('[WebRTC] SDP Answer created (send to backend):', answer.sdp.substring(0, 80) + '…')
    return answer.sdp
  }

  // ── Set remote SDP answer (after outbound call accepted) ───────────────────
  async function setRemoteAnswer(sdp) {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription({ type: 'answer', sdp })
    }
  }

  // ── Add remote ICE candidate ────────────────────────────────────────────────
  async function addIceCandidate(candidate) {
    if (pcRef.current) {
      await pcRef.current.addIceCandidate(candidate)
    }
  }

  // ── End call & cleanup ──────────────────────────────────────────────────────
  function endCall() {
    if (pcRef.current)          { pcRef.current.close();  pcRef.current = null }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null }
  }

  // ── Toggle local audio mute ─────────────────────────────────────────────────
  function setMuted(muted) {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !muted })
    }
  }

  return { startCall, answerCall, setRemoteAnswer, addIceCandidate, endCall, setMuted, remoteAudioRef }
}
