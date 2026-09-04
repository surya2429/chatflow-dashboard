import { createContext, useContext, useState, useEffect, useRef } from 'react'

const CallContext = createContext()
export const useCall = () => useContext(CallContext)

// ─── Graph API helper (logs payload; real calls go through your backend) ───────
function logGraphAPI(method, path, payload) {
  console.log(`[WhatsApp Calling API] ${method} https://graph.facebook.com/v25.0${path}`, payload || '')
}

export function CallProvider({ children }) {
  const [activeCall,   setActiveCall]   = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callLog,      setCallLog]      = useState([])
  const [callSummary,  setCallSummary]  = useState(null) // shown after call ends
  const timerRef = useRef(null)

  // ── Live duration ticker ────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeCall?.status === 'connected') {
      timerRef.current = setInterval(() => {
        setActiveCall(prev => prev?.status === 'connected' ? { ...prev, duration: prev.duration + 1 } : prev)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [activeCall?.status])

  // ── Initiate outbound call ──────────────────────────────────────────────────
  function initiateCall(contact) {
    logGraphAPI('POST', '/{PHONE_NUMBER_ID}/calls', {
      to: contact.phone, type: 'audio', call_sdp: '{SDP_OFFER_FROM_WEBRTC}',
    })
    const call = {
      callId:    `call_${Date.now()}`,
      contact,
      direction: 'outbound',
      status:    'ringing',
      startedAt: new Date(),
      duration:  0,
      muted:     false,
      onHold:    false,
    }
    setActiveCall(call)
    setCallSummary(null)
    // Simulate: ringing → connecting → connected
    setTimeout(() => setActiveCall(p => p ? { ...p, status: 'connecting' } : p), 1500)
    setTimeout(() => setActiveCall(p => p ? { ...p, status: 'connected'  } : p), 3000)
  }

  // ── Answer inbound call ─────────────────────────────────────────────────────
  function answerCall() {
    if (!incomingCall) return
    logGraphAPI('POST', `/{PHONE_NUMBER_ID}/calls/${incomingCall.callId}/answer`, {
      call_sdp: '{SDP_ANSWER_FROM_WEBRTC}',
    })
    setActiveCall({
      callId:    incomingCall.callId,
      contact:   { name: incomingCall.name, phone: incomingCall.from },
      direction: 'inbound',
      status:    'connected',
      startedAt: new Date(),
      duration:  0,
      muted:     false,
      onHold:    false,
    })
    setIncomingCall(null)
    setCallSummary(null)
  }

  // ── Decline inbound call ────────────────────────────────────────────────────
  function declineCall() {
    if (!incomingCall) return
    logGraphAPI('POST', `/{PHONE_NUMBER_ID}/calls/${incomingCall.callId}/terminate`)
    setIncomingCall(null)
  }

  // ── End active call ─────────────────────────────────────────────────────────
  function endCall() {
    if (!activeCall) return
    clearInterval(timerRef.current)
    logGraphAPI('POST', `/{PHONE_NUMBER_ID}/calls/${activeCall.callId}/terminate`)
    const summary = { ...activeCall, status: 'ended', endedAt: new Date() }
    setCallLog(prev => [summary, ...prev])
    setCallSummary(summary)
    setActiveCall(null)
  }

  // ── Mute / Hold toggles ─────────────────────────────────────────────────────
  function toggleMute() {
    setActiveCall(p => p ? { ...p, muted: !p.muted } : p)
  }
  function toggleHold() {
    setActiveCall(p => p ? { ...p, onHold: !p.onHold, status: p.onHold ? 'connected' : 'held' } : p)
  }

  function dismissSummary() { setCallSummary(null) }

  return (
    <CallContext.Provider value={{
      activeCall, incomingCall, callLog, callSummary,
      // expose setter so devs can test incoming calls from console:
      // window.__callCtx.setIncomingCall({ callId:'c1', from:'+91 98765 43210', name:'Test User', sdp:'' })
      setIncomingCall,
      initiateCall, answerCall, declineCall, endCall,
      toggleMute, toggleHold, dismissSummary,
    }}>
      {children}
    </CallContext.Provider>
  )
}
