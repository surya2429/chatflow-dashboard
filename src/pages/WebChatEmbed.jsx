// WebChatEmbed.jsx — what actually runs inside the widget's iframe on a
// customer's website.
//
// This is the reason the install snippet can promise it won't touch the host
// page's CSS. Everything the widget renders — Tailwind's preflight, the
// Google font, the keyframes in WidgetPreview's <style> block — lives in this
// document, not the customer's. An iframe is a separate document with its own
// cascade, so there is nothing to leak in either direction: no reset can
// restyle their buttons, and no `* { box-sizing: content-box }` or
// `font-size: 62.5%` of theirs can deform the widget. Shadow DOM alone would
// not be enough — inherited properties (font, color, line-height, direction)
// cross a shadow boundary, and the host page's own stylesheet still applies to
// the host element itself.
//
// Sizing is NOT measured from in here. The loader (public/widget.js) owns the
// iframe's box and we only tell it which state we're in; it clamps to the
// viewport. That keeps the "overlap" contract in one place: when closed, the
// iframe is exactly launcher-sized, so the widget intercepts clicks only where
// it is actually visible.
//
// Renders the same `WidgetPreview` as the dashboard preview and the landing
// page, for the same reason WebChatLandingPage does: a second implementation
// of the widget would drift from the one merchants configure.
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WidgetPreview, WIDGET_CFG_STORAGE_KEY } from './WebChatAppearance'
import { useVisitorCall } from '../hooks/useVisitorCall'
import { VisitorCallOverlay } from '../components/webchat/VisitorCallOverlay'

const DEFAULT_CFG = {
  colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
  fontFamily: 'Inter', botName: 'ChatBot', tagline: 'We reply instantly',
  greeting: 'Hi! 👋 How can I help you today?',
  avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
  showBranding: true, brandingUrl: '/', landingName: 'Support_Bot',
}

/* The iframe's box, per state. The loader clamps both against the viewport,
   so these are maximums rather than promises — a 640px-tall panel on a short
   laptop window becomes `calc(100vh - 40px)` there.

   Closed is deliberately tight around the 64px launcher: every pixel of the
   closed iframe is a pixel of the customer's page that can no longer be
   clicked through, which is exactly the "widget swallows my cookie banner"
   complaint. `launcherText` widens it only because that bubble is a real
   visible target when the merchant turns it on. */
const CLOSED_BOX      = { w: 92,  h: 92  }
const CLOSED_TEXT_BOX = { w: 280, h: 164 }
const OPEN_BOX        = { w: 420, h: 640 }

export const EMBED_MESSAGE_NAMESPACE = 'chatflow-widget'

export default function WebChatEmbed() {
  const [params] = useSearchParams()
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [screen, setScreen] = useState('closed')
  const [activeTab, setActiveTab] = useState('home')
  // The widget id travels in the script's own src (`widget.js?id=…`) and is
  // forwarded here by the loader.
  const widgetId = params.get('id') || ''
  // Per-BROWSER, not per-widget: this is the call-signaling room key, so
  // deriving it from the widget id would drop every visitor to the same site
  // into one shared room and hand an agent whichever of them answered first.
  const [visitorId] = useState(() => getOrCreateVisitorId(widgetId))

  const call = useVisitorCall(visitorId)

  /* Tell the loader which box to give us. Posted on every state change and
     once on mount, so the iframe is launcher-sized before the first paint the
     visitor sees rather than briefly covering a corner of their page. */
  const post = useCallback(payload => {
    try {
      window.parent?.postMessage({ __chatflow: EMBED_MESSAGE_NAMESPACE, ...payload }, '*')
    } catch { /* no parent (opened directly) — nothing to report to */ }
  }, [])

  useEffect(() => {
    const open = screen !== 'closed'
    const box = open ? OPEN_BOX : (cfg.launcherText ? CLOSED_TEXT_BOX : CLOSED_BOX)
    post({ type: 'state', open, w: box.w, h: box.h })
  }, [screen, cfg.launcherText, post])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WIDGET_CFG_STORAGE_KEY) || 'null')
      if (saved) setCfg(p => ({ ...p, ...saved }))
    } catch { /* first-party storage blocked in a third-party frame — defaults are fine */ }
  }, [])

  /* ChatFlow('open') on the host page reaches the widget through here. Only
     our own namespace is honoured; a page full of other embeds posting
     messages is normal and none of it is for us. */
  useEffect(() => {
    function onMessage(e) {
      if (!e.data || e.data.__chatflow !== EMBED_MESSAGE_NAMESPACE) return
      if (e.data.type === 'open') setScreen(s => (s === 'closed' ? 'home' : s))
      else if (e.data.type === 'close') setScreen('closed')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  /* The page behind the widget must show through. Vite's index.html and
     Tailwind's preflight both paint a background on <html>/<body>, which in an
     iframe would render as an opaque rectangle over the customer's site. */
  useEffect(() => {
    const prev = [document.documentElement.style.background, document.body.style.background]
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.background = prev[0]
      document.body.style.background = prev[1]
    }
  }, [])

  const open = screen !== 'closed'

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: 'transparent' }}>
      <div className={open ? 'w-full h-full p-2.5' : 'w-full h-full'}>
        <WidgetPreview cfg={cfg} screen={screen} device="desktop"
          activeTab={activeTab} setActiveTab={setActiveTab} setScreen={setScreen}
          previewQuestionTypes={undefined} scrollToQType={undefined}
          onVoiceCall={() => call.callAgent(false)}
          onVideoCall={() => call.callAgent(true)}/>
      </div>
      {open && <VisitorCallOverlay call={call} cfg={cfg} />}
    </div>
  )
}

/* Same shape as WebChatLandingPage's visitor identity, keyed per widget so two
   ChatFlow widgets on one browser don't share a thread.

   Third-party storage is the interesting case: inside an iframe on someone
   else's domain this is partitioned, and in Safari or with third-party cookies
   blocked it throws outright. A per-load id is the correct fallback — calling
   and the conversation still work for this page view, they just don't persist
   across reloads, which is far better than throwing on mount. */
function getOrCreateVisitorId(widgetId) {
  const key = `chatflow_visitor_${widgetId || 'default'}`
  const fresh = () => `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = fresh()
    localStorage.setItem(key, id)
    return id
  } catch {
    return fresh()
  }
}
