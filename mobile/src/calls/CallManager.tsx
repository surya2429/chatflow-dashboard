import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { randomUUID } from 'expo-crypto'
import { api } from '@/lib/api'
import { onLiveEvent } from '@/lib/live'
import { currentUser } from '@/lib/session'
import { getState } from '@/lib/store'
import type { Conversation } from '@/lib/types'
import { Signaling, type SignalMessage } from './signaling'
import { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, getUserMedia, switchCamera, type MediaStream } from './webrtc'
import {
  displayIncoming, endNative, listenNativeCalls, reportConnected, setNativeMuted, setSpeaker, startOutgoing,
} from './callkeep'
import { clearPending, takePending } from './pendingCall'

/**
 * Website Chat voice/video calling for the agent's phone.
 *
 * Same state machine and protocol as the dashboard's WebchatCallContext —
 *   call-request → ringing on the other side
 *   call-accept  → callee accepted; the CALLER creates and sends the offer
 *   offer/answer → SDP exchange;  ice-candidate → trickle;  hangup → end
 * — with the differences a phone needs:
 *
 *   * An incoming call can arrive three ways: the live stream (app open),
 *     an FCM data push → ConnectionService (Android, background/killed), or a
 *     PushKit push → CallKit (iOS, background/killed/locked). All three end
 *     up in `answer(callId)` / `decline(callId)` here.
 *   * The agent's phone isn't sitting in the room waiting. It connects to
 *     the signaling room only to answer; agent-api holds the visitor's
 *     call-request and replays it on connect.
 *   * ICE servers (STUN + short-lived TURN credentials) come from the API per
 *     call; STUN alone fails on most carrier networks.
 *
 * Call outcomes ("Inbound video call · 5m 40s · Answered by …") are written
 * into the thread by the server, which sees the whole call. Nothing to log here.
 */
export type CallStatus = 'incoming' | 'ringing' | 'connecting' | 'connected' | 'ended'

export interface CallState {
  /** Server call id for inbound calls; a local UUID for outbound ones (also the CallKit UUID). */
  callId: string
  conversationId: string
  name: string
  direction: 'inbound' | 'outbound'
  video: boolean
  status: CallStatus
  muted: boolean
  cameraOff: boolean
  speaker: boolean
  connectedAt: number | null
  endReason: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  error: string | null
}

interface CallApi {
  call: CallState | null
  placeCall(conversation: Conversation, video: boolean): Promise<void>
  answer(callId?: string): Promise<void>
  decline(callId?: string): void
  hangup(): void
  toggleMute(): void
  toggleCamera(): void
  toggleSpeaker(): void
  flipCamera(): void
  dismiss(): void
}

const Ctx = createContext<CallApi | null>(null)
export const useCalls = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCalls must be used inside CallProvider')
  return v
}

const END_TEXT: Record<string, string> = {
  hangup: 'Call ended', 'remote-hangup': 'Call ended', declined: 'Declined', 'no-peer': 'Visitor is not on the page',
  'no-answer': 'No answer', taken: 'Answered by a colleague', cancelled: 'Caller hung up', 'connection-lost': 'Connection lost',
  'media-error': 'Microphone or camera unavailable', forbidden: 'You can’t join this call', 'signaling-failed': 'Calling service unreachable',
}
export const endText = (reason: string | null) => (reason && END_TEXT[reason]) || 'Call ended'

export function CallProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<CallState | null>(null)
  const callRef = useRef<CallState | null>(null)
  const pc = useRef<RTCPeerConnection | null>(null)
  const signaling = useRef<Signaling | null>(null)
  const pendingIce = useRef<unknown[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const update = useCallback((patch: Partial<CallState> | null) => {
    const next = patch === null ? null : callRef.current ? { ...callRef.current, ...patch } : null
    callRef.current = next
    setCall(next)
  }, [])

  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)) }

  // ── teardown ──────────────────────────────────────────────────────────────
  const teardown = useCallback((reason: string, notifyPeer: boolean) => {
    const c = callRef.current
    if (!c || c.status === 'ended') return
    if (notifyPeer) signaling.current?.send({ type: 'hangup' })
    signaling.current?.close()
    signaling.current = null
    c.localStream?.getTracks().forEach(t => t.stop())
    pc.current?.close()
    pc.current = null
    pendingIce.current = []
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
    endNative(c.callId)
    void clearPending(c.callId)
    update({ status: 'ended', endReason: reason, localStream: null, remoteStream: null })
    // Show the outcome briefly, then clear the screen.
    setTimeout(() => { if (callRef.current?.callId === c.callId && callRef.current.status === 'ended') update(null) }, 1800)
  }, [update])

  // ── peer connection ───────────────────────────────────────────────────────
  const createPeer = useCallback(async (video: boolean) => {
    const { iceServers } = await api.iceServers()
    const stream = await getUserMedia(video)
    const peer = new RTCPeerConnection({ iceServers: iceServers as RTCIceServer[] })
    pc.current = peer
    stream.getTracks().forEach(t => peer.addTrack(t, stream))
    const p = peer as unknown as {
      addEventListener(type: string, fn: (e: any) => void): void
    }
    p.addEventListener('icecandidate', (e: { candidate: { toJSON?: () => unknown } | null }) => {
      if (e.candidate) signaling.current?.send({ type: 'ice-candidate', candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate })
    })
    p.addEventListener('track', (e: { streams: MediaStream[] }) => {
      if (e.streams[0]) update({ remoteStream: e.streams[0] })
    })
    p.addEventListener('connectionstatechange', () => {
      const state = peer.connectionState
      const c = callRef.current
      if (!c) return
      if (state === 'connected' && c.status !== 'connected') {
        update({ status: 'connected', connectedAt: Date.now() })
        reportConnected(c.callId, c.direction)
      } else if (state === 'failed') {
        teardown('connection-lost', true)
      }
    })
    update({ localStream: stream })
    return peer
  }, [teardown, update])

  const flushIce = async () => {
    const peer = pc.current
    if (!peer?.remoteDescription) return
    for (const cand of pendingIce.current.splice(0)) {
      await peer.addIceCandidate(new RTCIceCandidate(cand as RTCIceCandidateInit)).catch(() => {})
    }
  }

  // ── signaling messages ────────────────────────────────────────────────────
  const onSignal = useCallback(async (msg: SignalMessage) => {
    const c = callRef.current
    if (!c || c.status === 'ended') return
    try {
      switch (msg.type) {
        case 'peer-joined':
          if (c.direction === 'outbound' && !msg.present && c.status === 'ringing') {
            later(1500, () => { if (callRef.current?.status === 'ringing') teardown('no-peer', false) })
          }
          break
        case 'call-request':
          // The held request, replayed now that we've joined to answer.
          if (c.direction === 'inbound' && c.status === 'connecting') signaling.current?.send({ type: 'call-accept' })
          break
        case 'call-accept': {
          if (c.direction !== 'outbound') break
          update({ status: 'connecting' })
          const peer = await createPeer(c.video)
          const offer = await peer.createOffer({})
          await peer.setLocalDescription(offer)
          signaling.current?.send({ type: 'offer', sdp: offer.sdp ?? '' })
          break
        }
        case 'offer': {
          if (c.direction !== 'inbound') break
          const peer = await createPeer(c.video)
          await peer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }))
          await flushIce()
          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          signaling.current?.send({ type: 'answer', sdp: answer.sdp ?? '' })
          break
        }
        case 'answer':
          await pc.current?.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }))
          await flushIce()
          break
        case 'ice-candidate':
          pendingIce.current.push(msg.candidate)
          await flushIce()
          break
        case 'call-decline':
          teardown('declined', false)
          break
        case 'hangup':
          teardown(c.status === 'connected' ? 'remote-hangup' : 'cancelled', false)
          break
        case 'peer-left':
          if (c.status === 'connected' || c.status === 'connecting') {
            later(8000, () => { if (callRef.current?.callId === c.callId && callRef.current.status !== 'connected') teardown('connection-lost', false) })
          }
          break
      }
    } catch (err) {
      const media = String((err as Error)?.name ?? '').includes('NotAllowed') || String(err).includes('Permission')
      teardown(media ? 'media-error' : 'connection-lost', true)
    }
  }, [createPeer, teardown, update])

  const openSignaling = useCallback((conversationId: string) => {
    const s = new Signaling(conversationId, {
      onMessage: (m) => { void onSignal(m) },
      onClose: (code) => {
        const reason = code === 4409 ? 'taken' : code === 4403 ? 'forbidden' : 'signaling-failed'
        teardown(reason, false)
      },
    })
    signaling.current = s
    void s.open()
    return s
  }, [onSignal, teardown])

  // ── public actions ────────────────────────────────────────────────────────
  const ringIncoming = useCallback((info: { callId: string; conversationId: string; name: string; video: boolean }) => {
    const c = callRef.current
    if (c && c.status !== 'ended') return // busy — the server keeps ringing other agents / times out
    const next: CallState = {
      ...info, direction: 'inbound', status: 'incoming', muted: false, cameraOff: false, speaker: info.video,
      connectedAt: null, endReason: null, localStream: null, remoteStream: null, error: null,
    }
    callRef.current = next
    setCall(next)
  }, [])

  const answer = useCallback(async (callId?: string) => {
    let c = callRef.current
    if ((!c || c.status === 'ended') && callId) {
      // Answered from CallKit / ConnectionService before the app knew about it.
      const pending = await takePending(callId)
      if (!pending) return
      ringIncoming({ callId: pending.callId, conversationId: pending.conversationId, name: pending.callerName, video: pending.video })
      c = callRef.current
    }
    if (!c || c.direction !== 'inbound' || c.status !== 'incoming' || (callId && c.callId !== callId)) return
    update({ status: 'connecting' })
    openSignaling(c.conversationId)
    // If no held request shows up, the call already ended or someone else took it.
    later(6000, () => { if (callRef.current?.status === 'connecting' && !pc.current) teardown('taken', false) })
  }, [openSignaling, ringIncoming, teardown, update])

  const decline = useCallback((callId?: string) => {
    const c = callRef.current
    if (!c || c.status !== 'incoming' || (callId && c.callId !== callId)) return
    // Join just long enough to say no: the decline is queued and flushed on
    // open, agent-api ends the call (logging it) and relays it to the visitor.
    const s = new Signaling(c.conversationId, { onMessage: () => {}, onClose: () => {} })
    s.send({ type: 'call-decline' })
    void s.open()
    setTimeout(() => s.close(), 1500)
    teardown('declined', false)
  }, [teardown])

  const placeCall = useCallback(async (conversation: Conversation, video: boolean) => {
    if (callRef.current && callRef.current.status !== 'ended') return
    const callId = randomUUID()
    const next: CallState = {
      callId, conversationId: conversation.id, name: conversation.name, direction: 'outbound', video, status: 'ringing',
      muted: false, cameraOff: false, speaker: video, connectedAt: null, endReason: null, localStream: null, remoteStream: null, error: null,
    }
    callRef.current = next
    setCall(next)
    void startOutgoing(callId, conversation.name, video)
    const s = openSignaling(conversation.id)
    s.send({ type: 'call-request', video })
  }, [openSignaling])

  const hangup = useCallback(() => {
    const c = callRef.current
    if (!c) return
    if (c.status === 'incoming') return decline()
    teardown('hangup', true)
  }, [decline, teardown])

  const toggleMute = useCallback(() => {
    const c = callRef.current
    if (!c) return
    const muted = !c.muted
    c.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted })
    setNativeMuted(c.callId, muted)
    update({ muted })
  }, [update])

  const toggleCamera = useCallback(() => {
    const c = callRef.current
    if (!c) return
    const cameraOff = !c.cameraOff
    c.localStream?.getVideoTracks().forEach(t => { t.enabled = !cameraOff })
    update({ cameraOff })
  }, [update])

  const toggleSpeaker = useCallback(() => {
    const c = callRef.current
    if (!c) return
    setSpeaker(c.callId, !c.speaker)
    update({ speaker: !c.speaker })
  }, [update])

  const flipCamera = useCallback(() => switchCamera(callRef.current?.localStream ?? null), [])
  const dismiss = useCallback(() => { if (callRef.current?.status === 'ended') update(null) }, [update])

  // ── entry points: live stream + OS call UI ────────────────────────────────
  useEffect(() => onLiveEvent((ev) => {
    if (ev.kind === 'call.ringing' && ev.call.direction === 'inbound') {
      const me = currentUser()
      const conv = getState().conversations[ev.call.conversationId]
      // Mirrors whom the server rings: the assignee, else on-shift agents.
      const mine = conv?.agentId === me?.id
      const open = !conv?.agentId && me?.presence === 'online'
      if (mine || open) ringIncoming({ callId: ev.call.callId, conversationId: ev.call.conversationId, name: ev.call.contactName, video: ev.call.video })
    } else if (ev.kind === 'call.answered') {
      const c = callRef.current
      if (c?.status === 'incoming' && c.conversationId === ev.call.conversationId && ev.call.agentId !== currentUser()?.id) teardown('taken', false)
    } else if (ev.kind === 'call.ended') {
      const c = callRef.current
      if (c && c.conversationId === ev.call.conversationId && c.status === 'incoming') teardown(ev.call.endReason === 'no-answer' ? 'no-answer' : 'cancelled', false)
    }
  }), [ringIncoming, teardown])

  useEffect(() => listenNativeCalls({
    onAnswer: (id) => { void answer(id) },
    onEnd: (id) => {
      const c = callRef.current
      if (!c || c.callId !== id) return
      if (c.status === 'incoming') decline(id)
      else teardown('hangup', true)
    },
    onMute: (id, muted) => {
      const c = callRef.current
      if (c?.callId === id && c.muted !== muted) toggleMute()
    },
  }), [answer, decline, teardown, toggleMute])

  // An in-app ring on a phone with a native call UI also shows the system
  // screen, so it rings when the app is backgrounded mid-ring.
  useEffect(() => {
    if (call?.status === 'incoming') void displayIncoming(call.callId, call.name, call.video)
  }, [call?.status, call?.callId]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<CallApi>(() => ({
    call, placeCall, answer, decline, hangup, toggleMute, toggleCamera, toggleSpeaker, flipCamera, dismiss,
  }), [call, placeCall, answer, decline, hangup, toggleMute, toggleCamera, toggleSpeaker, flipCamera, dismiss])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
