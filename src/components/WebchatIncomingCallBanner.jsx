import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { useWebchatCall } from '../context/WebchatCallContext'

const AUTO_DECLINE_SECS = 30

export default function WebchatIncomingCallBanner() {
  const { incomingCall, answerCall, declineCall } = useWebchatCall()
  const [remaining, setRemaining] = useState(AUTO_DECLINE_SECS)
  const timerRef = useRef(null)

  // Reset + start countdown whenever a new incoming call arrives
  useEffect(() => {
    if (!incomingCall) { clearInterval(timerRef.current); setRemaining(AUTO_DECLINE_SECS); return }
    setRemaining(AUTO_DECLINE_SECS)
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); declineCall(); return AUTO_DECLINE_SECS }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [incomingCall?.callId])

  if (!incomingCall) return null

  // SVG countdown ring
  const r = 16, circ = 2 * Math.PI * r
  const progress = circ - (remaining / AUTO_DECLINE_SECS) * circ

  const initials = incomingCall.contact?.name
    ? incomingCall.contact.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
      <div className="mt-3 pointer-events-auto animate-fade-in">
        <div className="bg-white border border-surface-border rounded-2xl shadow-modal px-5 py-3.5 flex items-center gap-4 min-w-[360px] max-w-[480px]">

          {/* Animated ring + avatar */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
            <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold relative z-10">
              {initials}
            </div>
          </div>

          {/* Caller info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {incomingCall.video ? <Video size={11} className="text-blue-500" /> : <Phone size={11} className="text-blue-500" />}
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                Incoming Website Chat {incomingCall.video ? 'Video' : 'Voice'} Call
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 truncate">{incomingCall.contact?.name || 'Website Visitor'}</p>
            <p className="text-xs text-slate-400 font-mono">{incomingCall.contact?.visitorId}</p>
          </div>

          {/* Countdown ring */}
          <div className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <circle cx="18" cy="18" r={r} fill="none" stroke="#f59e0b" strokeWidth="2.5"
                strokeDasharray={circ} strokeDashoffset={progress}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <span className="text-[11px] font-bold text-slate-500 relative z-10">{remaining}</span>
          </div>

          {/* Answer */}
          <button
            onClick={answerCall}
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-colors shadow-sm flex-shrink-0"
            title="Answer"
          >
            <Phone size={17} />
          </button>

          {/* Decline */}
          <button
            onClick={declineCall}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-sm flex-shrink-0"
            title="Decline"
          >
            <PhoneOff size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
