import { useState } from 'react'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Wifi, WifiOff } from 'lucide-react'
import {
  useVisitorCall,
  STATUS_IDLE, STATUS_RINGING_OUT, STATUS_RINGING_IN, STATUS_CONNECTING, STATUS_CONNECTED,
} from '../hooks/useVisitorCall'
import clsx from 'clsx'

/**
 * WebChatCallTester — a standalone, unauthenticated "you are the website
 * visitor" page for exercising real webchat calling end-to-end without a
 * real embeddable chat widget (this repo doesn't have one — see the
 * WEBCHAT_CONVERSATIONS visitorId of any conversation and open this page
 * as ?visitorId=<that id> in a second tab, alongside the dashboard's
 * /webchat/inbox).
 *
 * This is a test utility, not production UI — it talks directly to the
 * signaling relay (signaling-server/, ws://localhost:8788) as role=visitor
 * via the shared useVisitorCall() hook (also used by the real embeddable
 * widget on /webchat-landing), independent of WebchatCallContext (which
 * is scoped to the authenticated dashboard's ConversationContext objects).
 */

function fmtDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function useQueryParam(name) {
  const [value] = useState(() => new URLSearchParams(window.location.search).get(name))
  return value
}

export default function WebChatCallTester() {
  const visitorId = useQueryParam('visitorId')

  const {
    status, callVideo, muted, videoOn, duration, error,
    localVideoRef, remoteVideoRef, signalingConnected, peerPresent,
    callAgent, answer, decline, hangup, toggleMute, toggleVideoOn,
  } = useVisitorCall(visitorId)

  if (!visitorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm text-center">
          <p className="font-semibold text-slate-800 mb-1">Missing visitorId</p>
          <p className="text-sm text-slate-500">
            Open this page as <code className="bg-slate-100 px-1 rounded">/call-test?visitorId=v_xxxxxxxx</code>,
            matching a conversation's Visitor ID in the Website Chat inbox.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Website Visitor</p>
            <p className="text-xs text-slate-400 font-mono">{visitorId}</p>
          </div>
          <div className={clsx('flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full',
            signalingConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
            {signalingConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {signalingConnected ? 'Signaling connected' : 'Disconnected'}
          </div>
        </div>

        <div className="px-5 py-2 border-b border-slate-100">
          <p className="text-xs text-slate-500">
            Agent side: <span className={clsx('font-semibold', peerPresent ? 'text-emerald-600' : 'text-slate-400')}>
              {peerPresent ? 'present (open this conversation on the dashboard)' : 'not connected'}
            </span>
          </p>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>
        )}

        {/* Video area */}
        {(callVideo && (status === STATUS_CONNECTING || status === STATUS_CONNECTED)) && (
          <div className="relative w-full aspect-video bg-slate-900">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video
              ref={localVideoRef} autoPlay muted playsInline
              className={clsx('absolute bottom-2 right-2 w-20 h-14 rounded-lg object-cover border border-white/30 shadow-md bg-slate-800 transition-opacity',
                videoOn ? 'opacity-100' : 'opacity-0')}
            />
          </div>
        )}

        {/* Status / controls */}
        <div className="p-5 flex flex-col items-center gap-4">
          {status === STATUS_IDLE && (
            <>
              <p className="text-sm text-slate-500">Not in a call</p>
              <div className="flex gap-3">
                <button onClick={() => callAgent(false)} disabled={!signalingConnected}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                  <Phone size={15} /> Call agent
                </button>
                <button onClick={() => callAgent(true)} disabled={!signalingConnected}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                  <Video size={15} /> Video call agent
                </button>
              </div>
            </>
          )}

          {status === STATUS_RINGING_OUT && (
            <>
              <p className="text-sm font-semibold text-slate-700">Ringing agent…</p>
              <button onClick={hangup} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                <PhoneOff size={15} /> Cancel
              </button>
            </>
          )}

          {status === STATUS_RINGING_IN && (
            <>
              <p className="text-sm font-semibold text-slate-700">
                Incoming {callVideo ? 'video' : 'voice'} call from the agent
              </p>
              <div className="flex gap-3">
                <button onClick={answer} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                  <Phone size={15} /> Answer
                </button>
                <button onClick={decline} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                  <PhoneOff size={15} /> Decline
                </button>
              </div>
            </>
          )}

          {(status === STATUS_CONNECTING || status === STATUS_CONNECTED) && (
            <>
              <p className="text-sm font-semibold text-slate-700">
                {status === STATUS_CONNECTING ? 'Connecting…' : fmtDuration(duration)}
              </p>
              <div className="flex gap-3">
                <button onClick={toggleMute}
                  className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors',
                    muted ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600')}>
                  {muted ? <MicOff size={15} /> : <Mic size={15} />} {muted ? 'Unmute' : 'Mute'}
                </button>
                {callVideo && (
                  <button onClick={toggleVideoOn}
                    className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors',
                      !videoOn ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600')}>
                    {videoOn ? <Video size={15} /> : <VideoOff size={15} />} {videoOn ? 'Camera' : 'Off'}
                  </button>
                )}
                <button onClick={hangup} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                  <PhoneOff size={15} /> Hang up
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
