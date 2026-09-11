// VisitorCallOverlay.jsx — the visitor-side call UI (ringing/connecting/
// connected, Answer/Decline, mute/camera/hang up), driven by useVisitorCall.
// Extracted out of WebChatLandingPage.jsx (its original home) so
// WebChatFlowLivePreview.jsx can share the exact same real calling UI
// instead of a second hand-rolled copy that could drift from it — every
// "real widget" surface a visitor could actually be on should look and
// behave identically when a call comes in.
import clsx from 'clsx'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import {
  STATUS_IDLE, STATUS_RINGING_OUT, STATUS_RINGING_IN, STATUS_CONNECTING, STATUS_CONNECTED,
} from '../../hooks/useVisitorCall'

export function fmtCallDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** Self-contained call overlay rendered on top of the widget frame while a
 *  call is ringing/connecting/active. Loosely themed off the widget's own
 *  brand color, but not pixel-matched to WidgetPreview's internals. */
export function VisitorCallOverlay({ call, cfg }) {
  const { status, callVideo, muted, videoOn, duration, error, localVideoRef, remoteVideoRef,
    answer, decline, hangup, toggleMute, toggleVideoOn } = call

  if (status === STATUS_IDLE) return null

  const brand = cfg.colorMode === 'gradient'
    ? `linear-gradient(135deg, ${cfg.color || '#0066ff'}, ${cfg.colorEnd || '#8B5CF6'})`
    : (cfg.color || '#0066ff')

  const showVideoArea = callVideo && (status === STATUS_CONNECTING || status === STATUS_CONNECTED)

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm rounded-[inherit] overflow-hidden text-white">
      {showVideoArea ? (
        <div className="relative flex-1 bg-slate-950">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <video
            ref={localVideoRef} autoPlay muted playsInline
            className={clsx('absolute bottom-4 right-4 w-24 h-16 rounded-lg object-cover border border-white/30 shadow-lg bg-slate-800 transition-opacity',
              videoOn ? 'opacity-100' : 'opacity-0')}
          />
          {status === STATUS_CONNECTING && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <p className="text-sm font-semibold">Connecting…</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ background: brand }}>
            {callVideo ? <Video size={24} /> : <Phone size={24} />}
          </div>
          <p className="text-sm font-semibold text-center">
            {status === STATUS_RINGING_OUT && 'Calling the team…'}
            {status === STATUS_RINGING_IN && `Incoming ${callVideo ? 'video' : 'voice'} call`}
            {status === STATUS_CONNECTING && 'Connecting…'}
            {status === STATUS_CONNECTED && fmtCallDuration(duration)}
          </p>
          {error && <p className="text-xs text-red-300 text-center max-w-[220px]">{error}</p>}
        </div>
      )}

      <div className="flex-shrink-0 px-5 py-4 flex items-center justify-center gap-3 bg-black/30">
        {status === STATUS_RINGING_OUT && (
          <button onClick={hangup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
            <PhoneOff size={15} /> Cancel
          </button>
        )}

        {status === STATUS_RINGING_IN && (
          <>
            <button onClick={answer}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
              <Phone size={15} /> Answer
            </button>
            <button onClick={decline}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
              <PhoneOff size={15} /> Decline
            </button>
          </>
        )}

        {(status === STATUS_CONNECTING || status === STATUS_CONNECTED) && (
          <>
            <button onClick={toggleMute}
              className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors',
                muted ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white')}>
              {muted ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
            {callVideo && (
              <button onClick={toggleVideoOn}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors',
                  !videoOn ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white')}>
                {videoOn ? <Video size={15} /> : <VideoOff size={15} />}
              </button>
            )}
            <button onClick={hangup}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
              <PhoneOff size={15} /> Hang up
            </button>
          </>
        )}
      </div>
    </div>
  )
}
