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
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WidgetPreview, WIDGET_CFG_STORAGE_KEY } from './WebChatAppearance'

const DEFAULT_CFG = {
  colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
  fontFamily: 'Inter', botName: 'ChatBot', tagline: 'We reply instantly',
  greeting: 'Hi! 👋 How can I help you today?',
  avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
  showBranding: true, landingName: 'Support_Bot',
}

export default function WebChatLandingPage() {
  const [params] = useSearchParams()
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [activeTab, setActiveTab] = useState('home')

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
      <div className="w-full max-w-md h-[85vh] max-h-[680px] flex flex-col">
        <WidgetPreview cfg={cfg} screen="open" device="desktop"
          activeTab={activeTab} setActiveTab={setActiveTab}
          previewQuestionTypes={undefined} scrollToQType={undefined}/>
      </div>
    </div>
  )
}
