import { useCallback, useEffect, useRef, useState } from 'react'
import { useCallSignaling } from './useCallSignaling'
import { useWebRTC } from './useWebRTC'

/**
 * useVisitorCall — the "visitor side" calling state machine, extracted from
 * WebChatCallTester.jsx so it can be reused by the real embeddable widget
 * (WebChatLandingPage.jsx) as well as the standalone test page.
 *
 * Connects to the signaling relay (signaling-server/, ws://localhost:8788)
 * as role=visitor in a room keyed by `visitorId`, and drives useWebRTC()
 * to place/receive real calls. Pure state/logic — no UI.
 */

export const STATUS_IDLE        = 'idle'
export const STATUS_RINGING_OUT = 'ringing-out'   // we called, waiting for accept
export const STATUS_RINGING_IN  = 'ringing-in'    // agent is calling us
export const STATUS_CONNECTING  = 'connecting'
export const STATUS_CONNECTED   = 'connected'

export function useVisitorCall(visitorId) {
  const [status, setStatus]   = useState(STATUS_IDLE)
  const [callVideo, setCallVideo] = useState(false)
  const [muted, setMutedState] = useState(false)
  const [videoOn, setVideoOnState] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')

  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])
  const callVideoRef = useRef(callVideo)
  useEffect(() => { callVideoRef.current = callVideo }, [callVideo])

  const timerRef = useRef(null)

  const signaling = useCallSignaling(visitorId, 'visitor')

  const webrtc = useWebRTC({
    onIceCandidate: candidate => signaling.send({ type: 'ice-candidate', candidate }),
    onConnectionStateChange: state => {
      if (state === 'connected') setStatus(STATUS_CONNECTED)
      else if ((state === 'failed' || state === 'closed') && statusRef.current !== STATUS_IDLE) {
        endLocal()
      }
    },
  })

  useEffect(() => {
    clearInterval(timerRef.current)
    if (status === STATUS_CONNECTED) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      setDuration(0)
    }
    return () => clearInterval(timerRef.current)
  }, [status])

  function endLocal() {
    clearInterval(timerRef.current)
    webrtc.endCall()
    setStatus(STATUS_IDLE)
    setDuration(0)
  }

  const handleMessage = useCallback(async msg => {
    switch (msg.type) {
      case 'call-request': {
        if (statusRef.current !== STATUS_IDLE) {
          signaling.send({ type: 'call-decline' })
          return
        }
        setCallVideo(!!msg.video)
        setStatus(STATUS_RINGING_IN)
        break
      }
      case 'call-accept': {
        if (statusRef.current !== STATUS_RINGING_OUT) return
        setStatus(STATUS_CONNECTING)
        try {
          const sdp = await webrtc.startCall(callVideoRef.current)
          signaling.send({ type: 'offer', sdp })
        } catch (err) {
          setError(err.message)
          signaling.send({ type: 'hangup' })
          endLocal()
        }
        break
      }
      case 'call-decline': {
        if (statusRef.current === STATUS_RINGING_OUT) endLocal()
        break
      }
      case 'offer': {
        if (statusRef.current !== STATUS_CONNECTING) return
        try {
          const sdp = await webrtc.answerCall(msg.sdp, callVideoRef.current)
          signaling.send({ type: 'answer', sdp })
        } catch (err) {
          setError(err.message)
          signaling.send({ type: 'hangup' })
          endLocal()
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
        if (statusRef.current !== STATUS_IDLE) endLocal()
        break
      }
      default:
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const unsubscribe = signaling.onMessage(handleMessage)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaling.onMessage, handleMessage])

  async function callAgent(video) {
    setError('')
    setCallVideo(video)
    setStatus(STATUS_RINGING_OUT)
    signaling.send({ type: 'call-request', video })
  }

  async function answer() {
    setError('')
    setStatus(STATUS_CONNECTING)
    signaling.send({ type: 'call-accept' })
    // Wait for the caller's offer — handled in handleMessage's 'offer' case.
  }

  function decline() {
    signaling.send({ type: 'call-decline' })
    setStatus(STATUS_IDLE)
  }

  function hangup() {
    signaling.send({ type: 'hangup' })
    endLocal()
  }

  function toggleMute() {
    const next = !muted
    setMutedState(next)
    webrtc.setMuted(next)
  }
  function toggleVideoOn() {
    const next = !videoOn
    setVideoOnState(next)
    webrtc.setVideoEnabled(next)
  }

  useEffect(() => {
    if (status === STATUS_CONNECTING || status === STATUS_CONNECTED) setVideoOnState(callVideo)
  }, [status, callVideo])

  return {
    status, callVideo, muted, videoOn, duration, error,
    localVideoRef: webrtc.localVideoRef, remoteVideoRef: webrtc.remoteVideoRef,
    signalingConnected: signaling.connected, peerPresent: signaling.peerPresent,
    callAgent, answer, decline, hangup, toggleMute, toggleVideoOn,
  }
}
