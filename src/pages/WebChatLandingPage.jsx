// WebChatLandingPage.jsx — the real page behind the Widget Builder's "Landing
// Page" link (see LandingPageTab in WebChatAppearance.jsx) and its "Preview
// Widget" button. Standalone, unauthenticated, no MainLayout — the entire
// viewport IS the chatbot, for sharing in emails/QR codes/bios where there's
// no website to install a widget snippet into. Reads its look (colors, font,
// avatar, greeting, launcher icon…) from localStorage, since that's the only
// channel between this route and the Widget Builder's in-memory state (see
// WIDGET_CFG_STORAGE_KEY in WebChatAppearance.jsx).
//
// Renders the SAME widget UI as the dashboard's own live preview — the real
// `WidgetPreview` component — instead of a hand-rolled second implementation
// that could drift from it. `WidgetPreview` doesn't have a canned-reply
// simulation of its own (its composer's send button just clears the draft,
// same as the dashboard's preview pane), so there's no separate "send" logic
// here to keep in sync — whatever WidgetPreview does is, by definition, the
// real interactivity.
//
// When the merchant has turned on Voice Call / Video Call (Behavior →
// Calling in the Widget Builder), this page also establishes a real visitor
// identity and drives useVisitorCall() so the Phone/Video buttons in the
// widget header place actual WebRTC calls against the signaling relay —
// the same infrastructure WebChatCallTester.jsx demonstrates, just embedded
// in the real widget instead of a standalone test page.
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import clsx from 'clsx'
import { WidgetPreview, WIDGET_CFG_STORAGE_KEY } from './WebChatAppearance'
import {
  useVisitorCall,
  STATUS_IDLE, STATUS_RINGING_OUT, STATUS_RINGING_IN, STATUS_CONNECTING, STATUS_CONNECTED,
} from '../hooks/useVisitorCall'

const DEFAULT_CFG = {
  colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
  fontFamily: 'Inter', botName: 'ChatBot', tagline: 'We reply instantly',
  greeting: 'Hi! 👋 How can I help you today?',
  avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
  showBranding: true, landingName: 'Support_Bot',
}

// Per-browser stable visitor identity for this landing page, so a real call
// can be placed/received against a consistent signaling "room". Mirrors the
// WIDGET_CFG_STORAGE_KEY export pattern — a small localStorage constant +
// helper, generated once and reused on subsequent visits from this browser.
export const LANDING_VISITOR_ID_KEY = 'webchat_landing_visitor_id'

function getOrCreateVisitorId() {
  try {
    const existing = localStorage.getItem(LANDING_VISITOR_ID_KEY)
    if (existing) return existing
    const id = `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(LANDING_VISITOR_ID_KEY, id)
    return id
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to a
    // per-mount id; calling still works within this page load, it just
    // won't persist across reloads.
    return `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  }
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** Self-contained call overlay rendered on top of the widget frame while a
 *  call is ringing/connecting/active. Loosely themed off the widget's own
 *  brand color, but not pixel-matched to WidgetPreview's internals. */
function CallOverlay({ call, cfg }) {
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
            {status === STATUS_CONNECTED && fmtDuration(duration)}
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

export default function WebChatLandingPage() {
  const [params] = useSearchParams()
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [activeTab, setActiveTab] = useState('home')
  const [visitorId] = useState(getOrCreateVisitorId)

  const call = useVisitorCall(visitorId)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WIDGET_CFG_STORAGE_KEY) || 'null')
      if (saved) { setCfg(p => ({ ...p, ...saved })); return }
    } catch {}
    // No saved widget config yet (Widget Builder was never opened this
    // session) — fall back to the bot name from the URL itself so the page
    // still shows something meaningful instead of the generic default.
    const name = params.get('name')
    if (name) setCfg(p => ({ ...p, botName: name.replace(/_/g, ' ') }))
  }, [])

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md h-[85vh] max-h-[680px] flex flex-col relative">
        <WidgetPreview cfg={cfg} screen="open" device="desktop"
          activeTab={activeTab} setActiveTab={setActiveTab}
          previewQuestionTypes={undefined} scrollToQType={undefined}
          onVoiceCall={() => call.callAgent(false)}
          onVideoCall={() => call.callAgent(true)}/>
        <CallOverlay call={call} cfg={cfg} />
      </div>
    </div>
  )
}
