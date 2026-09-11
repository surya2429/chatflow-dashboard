import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useCallSignaling } from '../hooks/useCallSignaling'
import { useWebRTC } from '../hooks/useWebRTC'
import { useConversations } from './ConversationContext'
import { fmtCallDuration } from '../components/webchat/VisitorCallOverlay'

const WebchatCallContext = createContext()
export const useWebchatCall = () => useContext(WebchatCallContext)

/**
 * WebchatCallProvider — Website Chat's real (non-simulated) voice/video
 * calling. Parallel to src/context/CallContext.jsx (WhatsApp's simulated
 * calling) in shape — activeCall/incomingCall/callLog, initiateCall/
 * answerCall/declineCall/endCall, toggleMute/toggleVideo — but every
 * transition here is driven by real signaling messages (relayed through
 * signaling-server/, ws://localhost:8788) and the RTCPeerConnection's real
 * connectionState, never by a setTimeout.
 *
 * Signaling protocol (dumb relay, one agent + one visitor per room):
 *   call-request  → ringing on the other side
 *   call-accept   → callee accepted; caller now creates + sends the SDP offer
 *   call-decline  → callee declined; caller cleans up
 *   offer / answer → SDP exchange
 *   ice-candidate → ICE trickle
 *   hangup        → either side ended the call
 *
 * The dashboard only holds a signaling connection open for one "room"
 * (a webchat visitorId) at a time — the room of whatever call is currently
 * ringing/active, or otherwise whichever conversation is currently open in
 * WebChatInbox (see setWatchedVisitor, called from ChatWindow) so an inbound
 * call-request from that visitor can be caught while their chat is open.
 */
export function WebchatCallProvider({ children }) {
  const [activeCall,   setActiveCall]   = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callLog,      setCallLog]      = useState([])
  const [callSummary,  setCallSummary]  = useState(null)
  const [watchedVisitorId, setWatchedVisitorId] = useState(null)

  const timerRef          = useRef(null)
  const activeCallRef     = useRef(null)
  const incomingCallRef   = useRef(null)
  const requestSentForRef = useRef(null) // callId we've already sent call-request for

  useEffect(() => { activeCallRef.current = activeCall }, [activeCall])
  useEffect(() => { incomingCallRef.current = incomingCall }, [incomingCall])

  // Logs every call outcome (answered, missed, declined, cancelled, or
  // failed to connect at all) as a real `type: 'event'` message in the
  // visitor's own conversation thread — same shape the seeded call entries
  // in constants/mockData.js already use — so reviewing that conversation
  // later shows the call actually happened instead of leaving zero trace
  // of it, which is what every real call did before this existed.
  const { everyConversation, logEvent } = useConversations()
  const everyConversationRef = useRef(everyConversation)
  useEffect(() => { everyConversationRef.current = everyConversation }, [everyConversation])

  const OUTCOME_TEXT = {
    declined: 'Declined', 'no-answer': 'No answer', 'no-peer': 'No answer',
    'signaling-unreachable': 'Failed — calling service unreachable',
    'media-error': 'Failed — microphone/camera unavailable',
    'remote-hangup': 'Missed', 'caller-cancelled': 'Missed', 'connection-lost': 'Disconnected',
    'local-hangup': 'Cancelled',
  }
  const logCallEvent = useCallback((visitorId, { direction, video, duration = 0, endReason }) => {
    const conv = everyConversationRef.current.find(c => c.visitorId === visitorId)
    if (!conv) return // no Inbox conversation for this visitor to log against
    const dir = direction === 'outbound' ? 'Outbound' : 'Inbound'
    const kind = video ? 'video call' : 'voice call'
    if (duration > 0) {
      logEvent(conv.id, 'call_answered', `${dir} ${kind} · ${fmtCallDuration(duration)} · Answered`)
    } else {
      logEvent(conv.id, 'call_missed', `${dir} ${kind} · ${OUTCOME_TEXT[endReason] || 'Missed'}`)
    }
  }, [logEvent])

  // Which room the signaling socket should be connected to right now.
  const roomId = activeCall?.contact?.visitorId || incomingCall?.contact?.visitorId || watchedVisitorId || null

  const signaling = useCallSignaling(roomId, 'agent')

  const webrtc = useWebRTC({
    onIceCandidate: candidate => signaling.send({ type: 'ice-candidate', candidate }),
    onConnectionStateChange: state => {
      if (state === 'connected') {
        setActiveCall(prev => (prev && prev.status !== 'connected') ? { ...prev, status: 'connected' } : prev)
      } else if (state === 'failed' || state === 'closed') {
        // Only react if we still think we're in a call — avoids double-cleanup.
        if (activeCallRef.current) finishCall('connection-lost')
      }
    },
  })

  // ── Live duration ticker (a real clock — not a fake state transition) ──────
  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeCall?.status === 'connected') {
      timerRef.current = setInterval(() => {
        setActiveCall(prev => prev?.status === 'connected' ? { ...prev, duration: prev.duration + 1 } : prev)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [activeCall?.status])

  // ── Send call-request as soon as we've connected for an outbound call ──────
  useEffect(() => {
    if (
      signaling.connected &&
      activeCall?.direction === 'outbound' &&
      activeCall.status === 'ringing' &&
      requestSentForRef.current !== activeCall.callId
    ) {
      requestSentForRef.current = activeCall.callId
      signaling.send({ type: 'call-request', video: activeCall.video })
    }
  }, [signaling.connected, activeCall?.callId, activeCall?.direction, activeCall?.status, activeCall?.video])

  // ── Give up if the signaling relay never comes up ───────────────────────────
  // Without this, a call started while signaling-server/ isn't running (or is
  // unreachable for any other reason) just sits on "Ringing…" forever — no
  // call-request can be sent because that only happens once `signaling.
  // connected` is true, and nothing ever tells the agent anything is wrong.
  // That silent hang is indistinguishable from "calling doesn't work at all",
  // which is exactly the confusing state a dev environment with only the Vite
  // server (and not the separate signaling-server/) running ends up in.
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'ringing' || signaling.connected) return
    const callId = activeCall.callId
    const t = setTimeout(() => {
      if (activeCallRef.current?.callId === callId && !signaling.connected) {
        finishCall('signaling-unreachable')
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [activeCall?.callId, activeCall?.status, signaling.connected])

  // ── Give up if nobody's even there to answer ────────────────────────────────
  // Signaling being reachable only proves the relay itself is up — it says
  // nothing about whether any visitor-side page (the standalone Live Preview
  // tab, or /call-test) is actually open and connected to this exact room.
  // There is no real deployed widget anywhere for a call to reach in this
  // codebase (see the plan this call feature was built from) — someone has to
  // deliberately have a visitor-side tab open for a test call to have anyone
  // to ring. Without this, calling a visitor with no such tab open just rings
  // forever with no signal that anything's actually wrong, which reads
  // identically to the feature being broken.
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'ringing' || !signaling.connected) return
    const callId = activeCall.callId
    // A short grace period covers the normal case where the visitor tab's own
    // signaling socket is still mid-handshake when this call starts.
    const t = setTimeout(() => {
      if (activeCallRef.current?.callId === callId && !signaling.peerPresent) {
        finishCall('no-peer')
      }
    }, 4000)
    return () => clearTimeout(t)
  }, [activeCall?.callId, activeCall?.status, signaling.connected, signaling.peerPresent])

  // ── Give up if someone's there but never answers ────────────────────────────
  // Mirrors a real phone call timing out unanswered, so a forgotten/AFK
  // visitor tab doesn't leave the agent's call widget ringing indefinitely.
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'ringing') return
    const callId = activeCall.callId
    const t = setTimeout(() => {
      if (activeCallRef.current?.callId === callId) finishCall('no-answer')
    }, 30000)
    return () => clearTimeout(t)
  }, [activeCall?.callId, activeCall?.status])

  function finishCall(reason) {
    clearInterval(timerRef.current)
    const current = activeCallRef.current
    webrtc.endCall()
    if (current) {
      const summary = { ...current, status: 'ended', endReason: reason, endedAt: new Date() }
      setCallLog(prev => [summary, ...prev])
      setCallSummary(summary)
      logCallEvent(current.contact?.visitorId, { direction: current.direction, video: current.video, duration: current.duration, endReason: reason })
    }
    setActiveCall(null)
    requestSentForRef.current = null
  }

  // ── Handle signaling messages (real events, no timers) ──────────────────────
  const handleMessage = useCallback(async msg => {
    switch (msg.type) {
      case 'call-request': {
        // Inbound call from the visitor in the currently-connected room.
        if (activeCallRef.current || incomingCallRef.current) {
          // Already busy — decline automatically.
          signaling.send({ type: 'call-decline' })
          return
        }
        setIncomingCall({
          callId: `wc_in_${Date.now()}`,
          contact: { visitorId: roomId, name: 'Website Visitor', avatar: 'V' },
          video: !!msg.video,
          receivedAt: new Date(),
        })
        break
      }

      case 'call-accept': {
        // Our outbound call was accepted — create + send the SDP offer.
        const call = activeCallRef.current
        if (!call || call.direction !== 'outbound') return
        setActiveCall(prev => prev ? { ...prev, status: 'connecting' } : prev)
        try {
          const sdp = await webrtc.startCall(call.video)
          signaling.send({ type: 'offer', sdp })
        } catch (err) {
          console.error('[WebchatCall] Failed to start call after accept:', err)
          signaling.send({ type: 'hangup' }) // let the other side know — they already accepted and are waiting
          finishCall('media-error')
        }
        break
      }

      case 'call-decline': {
        if (activeCallRef.current?.direction === 'outbound') finishCall('declined')
        break
      }

      case 'offer': {
        // We're the callee and already answered locally — build + send the SDP answer.
        const call = activeCallRef.current
        if (!call || call.direction !== 'inbound') return
        try {
          const sdp = await webrtc.answerCall(msg.sdp, call.video)
          signaling.send({ type: 'answer', sdp })
        } catch (err) {
          console.error('[WebchatCall] Failed to answer call:', err)
          signaling.send({ type: 'hangup' })
          finishCall('media-error')
        }
        break
      }

      case 'answer': {
        await webrtc.setRemoteAnswer(msg.sdp)
        break
      }

      case 'ice-candidate': {
        await webrtc.addIceCandidate(msg.candidate)
        break
      }

      case 'hangup': {
        if (activeCallRef.current) finishCall('remote-hangup')
        // The caller hung up before we ever answered — finishCall never
        // runs for this path (no activeCall was ever set), so without this
        // it's the one call outcome that logged nothing at all.
        if (incomingCallRef.current) {
          logCallEvent(incomingCallRef.current.contact?.visitorId, { direction: 'inbound', video: incomingCallRef.current.video, endReason: 'caller-cancelled' })
          setIncomingCall(null)
        }
        break
      }

      default:
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  useEffect(() => {
    const unsubscribe = signaling.onMessage(handleMessage)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaling.onMessage, handleMessage])

  // ── Initiate outbound call ──────────────────────────────────────────────────
  function initiateCall(conversation, { video = false } = {}) {
    if (activeCall || !conversation?.visitorId) return
    setCallSummary(null)
    setActiveCall({
      callId:    `wc_out_${Date.now()}`,
      contact:   { name: conversation.name, avatar: conversation.avatar, visitorId: conversation.visitorId },
      direction: 'outbound',
      status:    'ringing',
      video,
      videoEnabled: video,
      muted:     false,
      duration:  0,
      startedAt: new Date(),
    })
  }

  // ── Answer inbound call ─────────────────────────────────────────────────────
  function answerCall() {
    if (!incomingCall) return
    setCallSummary(null)
    setActiveCall({
      callId:    incomingCall.callId,
      contact:   incomingCall.contact,
      direction: 'inbound',
      status:    'connecting',
      video:     incomingCall.video,
      videoEnabled: incomingCall.video,
      muted:     false,
      duration:  0,
      startedAt: new Date(),
    })
    setIncomingCall(null)
    signaling.send({ type: 'call-accept' })
  }

  // ── Decline inbound call ────────────────────────────────────────────────────
  function declineCall() {
    if (!incomingCall) return
    signaling.send({ type: 'call-decline' })
    logCallEvent(incomingCall.contact?.visitorId, { direction: 'inbound', video: incomingCall.video, endReason: 'declined' })
    setIncomingCall(null)
  }

  // ── End active call ─────────────────────────────────────────────────────────
  function endCall() {
    if (!activeCall) return
    signaling.send({ type: 'hangup' })
    finishCall('local-hangup')
  }

  // ── Mute / video toggles ─────────────────────────────────────────────────────
  function toggleMute() {
    setActiveCall(p => {
      if (!p) return p
      const muted = !p.muted
      webrtc.setMuted(muted)
      return { ...p, muted }
    })
  }
  function toggleVideo() {
    setActiveCall(p => {
      if (!p || !p.video) return p
      const videoEnabled = !p.videoEnabled
      webrtc.setVideoEnabled(videoEnabled)
      return { ...p, videoEnabled }
    })
  }

  function dismissSummary() { setCallSummary(null) }

  // Called by WebChatInbox's ChatWindow when the open conversation changes,
  // so an inbound call-request from that visitor can be caught even before
  // any call has been placed.
  function setWatchedVisitor(visitorId) { setWatchedVisitorId(visitorId || null) }

  return (
    <WebchatCallContext.Provider value={{
      activeCall, incomingCall, callLog, callSummary,
      signalingConnected: signaling.connected,
      peerPresent: signaling.peerPresent,
      initiateCall, answerCall, declineCall, endCall,
      toggleMute, toggleVideo, dismissSummary, setWatchedVisitor,
      localVideoRef: webrtc.localVideoRef,
      remoteVideoRef: webrtc.remoteVideoRef,
      remoteAudioRef: webrtc.remoteAudioRef,
    }}>
      {children}
    </WebchatCallContext.Provider>
  )
}
