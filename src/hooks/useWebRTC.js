import { useRef } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * useWebRTC — manages RTCPeerConnection for calling.
 *
 * Originally scaffolded for WhatsApp Business Calling (Meta Graph API) and
 * now also used by Website Chat calling (src/context/WebchatCallContext.jsx),
 * which pairs it with a real signaling transport (src/hooks/useCallSignaling.js,
 * talking to signaling-server/) instead of Meta's Graph API.
 *
 * `onIceCandidate` (optional, passed to useWebRTC()) is invoked with each
 * local ICE candidate as it's discovered — the caller is responsible for
 * relaying it to the other peer over whatever signaling transport it's
 * using. Without a signaling transport wired up, candidates and SDP are
 * only logged (as before).
 *
 * Real integration flow (Website Chat, via the local signaling relay):
 *   Outbound: startCall(video) → get SDP offer → send over signaling as
 *             { type:'offer', sdp } → other peer replies { type:'answer', sdp } →
 *             setRemoteAnswer(sdp)
 *
 *   Inbound:  signaling delivers { type:'offer', sdp } →
 *             answerCall(remoteSdp, video) → get SDP answer → send over
 *             signaling as { type:'answer', sdp }
 *
 *   Both directions: local ICE candidates are sent as { type:'ice-candidate',
 *   candidate } over signaling; remote ones arrive the same way and are fed
 *   into addIceCandidate().
 */
export function useWebRTC({ onIceCandidate, onConnectionStateChange } = {}) {
  const pcRef           = useRef(null)
  const localStreamRef  = useRef(null)
  const remoteAudioRef  = useRef(null) // attach to <audio autoPlay ref={remoteAudioRef} /> — audio-only calls
  const localVideoRef   = useRef(null) // attach to <video autoPlay muted playsInline ref={localVideoRef} /> — camera preview
  const remoteVideoRef  = useRef(null) // attach to <video autoPlay playsInline ref={remoteVideoRef} /> — remote peer's video

  // ── Get microphone (+ optionally camera) access ─────────────────────────────
  async function getLocalStream(video) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!video })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      return stream
    } catch (err) {
      console.error('[WebRTC] Media access denied:', err)
      throw new Error(
        video
          ? 'Camera/microphone permission required for video calls. Please allow access in your browser settings.'
          : 'Microphone permission required for calls. Please allow access in your browser settings.'
      )
    }
  }

  // ── Create peer connection ──────────────────────────────────────────────────
  function createPC() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcRef.current = pc

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        if (onIceCandidate) {
          onIceCandidate(candidate.toJSON ? candidate.toJSON() : candidate)
        } else {
          console.log('[WebRTC] ICE candidate (no signaling wired up):', candidate.candidate)
        }
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState)
      if (onConnectionStateChange) onConnectionStateChange(pc.connectionState)
    }

    // Shared handler for both audio-only and video calls: attach the full
    // remote stream to whichever ref is mounted for the current call UI.
    pc.ontrack = ({ streams }) => {
      const stream = streams[0]
      if (!stream) return
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream
    }

    return pc
  }

  // ── Outbound: create offer ──────────────────────────────────────────────────
  async function startCall(video = false) {
    const stream = await getLocalStream(video)
    const pc     = createPC()
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    console.log('[WebRTC] SDP Offer created:', offer.sdp.substring(0, 80) + '…')
    return offer.sdp
  }

  // ── Inbound: create answer from remote offer ────────────────────────────────
  async function answerCall(remoteSdp, video = false) {
    const stream = await getLocalStream(video)
    const pc     = createPC()
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    await pc.setRemoteDescription({ type: 'offer', sdp: remoteSdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    console.log('[WebRTC] SDP Answer created:', answer.sdp.substring(0, 80) + '…')
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
      try {
        await pcRef.current.addIceCandidate(candidate)
      } catch (err) {
        console.error('[WebRTC] Failed to add ICE candidate:', err)
      }
    }
  }

  // ── End call & cleanup ──────────────────────────────────────────────────────
  function endCall() {
    if (pcRef.current)          { pcRef.current.close();  pcRef.current = null }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null }
    if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = null }
    if (localVideoRef.current)  { localVideoRef.current.srcObject = null }
  }

  // ── Toggle local audio mute ─────────────────────────────────────────────────
  function setMuted(muted) {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !muted })
    }
  }

  // ── Toggle local video on/off (camera stays acquired, track just disabled) ─
  function setVideoEnabled(enabled) {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !!enabled })
    }
  }

  return {
    startCall, answerCall, setRemoteAnswer, addIceCandidate, endCall,
    setMuted, setVideoEnabled,
    remoteAudioRef, localVideoRef, remoteVideoRef,
  }
}
