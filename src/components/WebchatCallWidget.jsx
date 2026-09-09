import { useState } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, ChevronUp, ChevronDown, Phone, MessageSquare } from 'lucide-react'
import { useWebchatCall } from '../context/WebchatCallContext'
import clsx from 'clsx'

function fmtDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function Waveform({ active }) {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[0.4, 0.8, 1, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
        <div
          key={i}
          className={clsx(
            'w-[3px] rounded-full transition-all',
            active ? 'bg-blue-400' : 'bg-slate-300'
          )}
          style={{
            height: active ? `${h * 20}px` : '4px',
            animation: active ? `wcwave ${0.6 + i * 0.1}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}

// Summary shown after call ends
function CallSummary({ summary, onDismiss }) {
  if (!summary) return null
  return (
    <div className="fixed bottom-6 right-6 z-[90] animate-fade-in">
      <div className="bg-white border border-surface-border rounded-2xl shadow-modal p-4 w-72">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <Phone size={14} className="text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">Call ended</p>
            <p className="text-[10px] text-slate-400">{summary.contact?.name || 'Website Visitor'}</p>
          </div>
          <button onClick={onDismiss} className="text-slate-300 hover:text-slate-500 text-lg leading-none">×</button>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mb-3">
          <span className="capitalize">{summary.direction}</span>
          <span className="font-mono font-semibold text-slate-700">{fmtDuration(summary.duration)}</span>
          <span className="capitalize">{summary.status === 'ended' ? 'Completed' : summary.status}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onDismiss} className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1.5">
            <MessageSquare size={11} /> Add note
          </button>
          <button onClick={onDismiss} className="btn-ghost text-xs text-slate-400 flex-1">Dismiss</button>
        </div>
      </div>
    </div>
  )
}

export default function WebchatCallWidget() {
  const {
    activeCall, callSummary, toggleMute, toggleVideo, endCall, dismissSummary,
    localVideoRef, remoteVideoRef, remoteAudioRef,
  } = useWebchatCall()
  const [expanded, setExpanded] = useState(false)

  if (!activeCall && !callSummary) return null
  if (!activeCall) return <CallSummary summary={callSummary} onDismiss={dismissSummary} />

  const { contact, status, duration, muted, videoEnabled, video } = activeCall
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  const initials = contact?.name
    ? contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'V'

  const statusLabel =
    status === 'ringing'    ? 'Ringing…'    :
    isConnecting             ? 'Connecting…' :
    isConnected              ? fmtDuration(duration) : '…'

  return (
    <>
      {/* Remote audio element — only used for audio-only calls */}
      <audio autoPlay playsInline className="hidden" ref={remoteAudioRef} />

      <div className="fixed bottom-6 right-6 z-[90] animate-fade-in select-none">
        <div className={clsx(
          'bg-white border border-surface-border rounded-2xl shadow-modal transition-all duration-200 overflow-hidden',
          expanded ? 'w-80' : 'w-72'
        )}>
          {/* Video area (video calls only) */}
          {video && (
            <div className="relative w-full aspect-video bg-slate-900">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                  <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg font-bold">
                    {initials}
                  </div>
                </div>
              )}
              {/* Local camera preview (picture-in-picture) */}
              <video
                ref={localVideoRef} autoPlay muted playsInline
                className={clsx(
                  'absolute bottom-2 right-2 w-16 h-12 rounded-lg object-cover border border-white/30 shadow-md bg-slate-800 transition-opacity',
                  videoEnabled ? 'opacity-100' : 'opacity-0'
                )}
              />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 p-4 pb-3">
            {!video && (
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 transition-colors',
                isConnected ? 'bg-blue-500 ring-blue-200' : 'bg-slate-400 ring-slate-200'
              )}>
                {initials}
              </div>
            )}

            {/* Contact + status */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{contact?.name || 'Website Visitor'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isConnected && !video && <Waveform active={isConnected && !muted} />}
                <span className={clsx(
                  'text-[11px] font-mono font-semibold',
                  isConnected ? 'text-blue-600' : 'text-slate-400'
                )}>{statusLabel}</span>
              </div>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded(p => !p)}
              className="p-1 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Expanded info */}
          {expanded && (
            <div className="px-4 pb-3 space-y-1.5 border-b border-surface-border">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Visitor ID</span>
                <span className="font-mono text-slate-600">{contact?.visitorId || '—'}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Direction</span>
                <span className="capitalize text-slate-600">{activeCall.direction}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Duration</span>
                <span className="font-mono text-slate-600">{fmtDuration(duration)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            {/* Mute */}
            <button
              onClick={toggleMute}
              disabled={!isConnected && !isConnecting}
              title={muted ? 'Unmute' : 'Mute'}
              className={clsx(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-colors',
                muted
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
                (!isConnected && !isConnecting) && 'opacity-40 cursor-not-allowed'
              )}
            >
              {muted ? <MicOff size={15} /> : <Mic size={15} />}
              {muted ? 'Unmute' : 'Mute'}
            </button>

            {/* Camera on/off — video calls only */}
            {video && (
              <button
                onClick={toggleVideo}
                disabled={!isConnected && !isConnecting}
                title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-colors',
                  !videoEnabled
                    ? 'bg-red-50 text-red-500 hover:bg-red-100'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
                  (!isConnected && !isConnecting) && 'opacity-40 cursor-not-allowed'
                )}
              >
                {videoEnabled ? <Video size={15} /> : <VideoOff size={15} />}
                {videoEnabled ? 'Camera' : 'Off'}
              </button>
            )}

            {/* End */}
            <button
              onClick={endCall}
              title="End call"
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
            >
              <PhoneOff size={15} />
              End
            </button>
          </div>
        </div>
      </div>

      {/* Wave keyframe */}
      <style>{`
        @keyframes wcwave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1);   }
        }
      `}</style>
    </>
  )
}
