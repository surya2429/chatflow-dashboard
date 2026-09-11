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
import { WidgetPreview, WIDGET_CFG_STORAGE_KEY } from './WebChatAppearance'
import { useVisitorCall } from '../hooks/useVisitorCall'
import { VisitorCallOverlay } from '../components/webchat/VisitorCallOverlay'
import { saveFlowTestConversation, hashToVisitorNumber, detectBrowserOS, detectTimezone, detectReferrer } from './WebChatFlowBuilder'

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

// Gives a landing-page visitor a minimal, real presence in the Website Chat
// Inbox — without this, an agent has no conversation to open for this
// visitorId, ChatWindow's setWatchedVisitor(visitorId) (which is what makes
// the agent's signaling socket join that visitor's call room) never fires
// for them, and NEITHER direction of calling can ever work: the agent has
// nothing to click "Call" on, and the visitor's own "Call agent" just times
// out (see the no-peer ringing-timeout in WebchatCallContext.jsx) because no
// agent is or ever could be listening. Reuses the exact same persisted store
// (and the same ConversationContext sync) the flow-test surfaces already
// write into — this store was never actually specific to "flow tests", just
// to every non-mock, non-authenticated surface that needs a bridge into the
// authenticated dashboard's Inbox.
function useLandingVisitorInboxSync(visitorId, cfg) {
  useEffect(() => {
    if (!visitorId) return
    const num = hashToVisitorNumber(visitorId)
    const env = detectBrowserOS()
    try {
      saveFlowTestConversation({
        id: `landing_${visitorId}`,
        visitorId,
        name: `Visitor #${num}`,
        avatar: `V${String(num)[0]}`,
        channel: 'webchat',
        page: (typeof window !== 'undefined' && window.location?.pathname) || '/',
        browser: env.browser, os: env.os, location: detectTimezone(),
        referrer: detectReferrer(), firstSeen: 'Just now', visits: 1,
        lastMessage: `Opened ${cfg.botName || 'the chat widget'}`,
        time: 'Just now', unread: 0, status: 'bot',
        tags: [], labels: [], agentId: null, agentName: null,
        source: 'direct', starred: false, archived: false, snoozed: null,
        timestamp: new Date().toISOString(),
        messages: [{ id: 'm1', type: 'event', event: 'opened', text: 'Visitor opened the chat widget', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }],
      })
    } catch {}
    // Deliberately only on mount (visitorId/cfg.botName) — this just needs to
    // get the visitor discoverable/watchable, not mirror a live transcript
    // (this demo page has no real chat backend to mirror in the first place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId, cfg.botName])
}

export default function WebChatLandingPage() {
  const [params] = useSearchParams()
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  // 'chat', not 'home' — this whole page IS a dedicated share link straight
  // into the conversation (per the file comment: "the entire viewport IS the
  // chatbot"), and WidgetPreview's `currentScreenKey` only ever resolves to
  // the chat screen when either a live simThread is present (it isn't here —
  // this page has no flow simulation) or `activeTab === 'chat'` /
  // `screen === 'chat'`. Defaulting to 'home' — WidgetPreview's own default —
  // left this page stranded on the Home tab with no way to reach the chat
  // screen at all unless the merchant had specifically configured 2+ tabs in
  // the Widget Builder, which also meant the chat header's Voice/Video Call
  // buttons (only rendered in the chat screen's header) were unreachable.
  const [activeTab, setActiveTab] = useState('chat')
  const [visitorId] = useState(getOrCreateVisitorId)

  const call = useVisitorCall(visitorId)
  useLandingVisitorInboxSync(visitorId, cfg)

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
        <WidgetPreview cfg={cfg} screen="chat" device="desktop"
          activeTab={activeTab} setActiveTab={setActiveTab}
          previewQuestionTypes={undefined} scrollToQType={undefined}
          onVoiceCall={() => call.callAgent(false)}
          onVideoCall={() => call.callAgent(true)}/>
        <VisitorCallOverlay call={call} cfg={cfg} />
      </div>
    </div>
  )
}
