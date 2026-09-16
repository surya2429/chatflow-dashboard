// WebChatEmbed.jsx — what actually runs inside the widget's iframe on a
// customer's website.
//
// This renders THE BOT, not a preview of one. A bot has two halves, both
// edited in the dashboard against the same bot id and both delivered here:
//
//   config.appearance — how it looks  (Widget Builder / Appearance)
//   config.flows      — what it does  (Automation / Flow Builder)
//
// so the widget a visitor talks to runs the merchant's real automation, styled
// with their real design. Previously this only rendered the appearance side,
// which meant an installed widget looked right and then did nothing — the
// automation the merchant actually built was never reachable from their site.
//
// Both halves arrive over the live stream (see lib/liveConfig.js), so editing
// either one in the dashboard updates widgets already open on visitors'
// screens without the merchant re-pasting the snippet.
//
// On CSS isolation: everything this document renders — Tailwind's preflight,
// the Google font, WidgetPreview's keyframes — lives in THIS document, not the
// customer's. An iframe is a separate document with its own cascade, so
// nothing leaks either way: no reset of ours can restyle their buttons, and no
// `* { box-sizing: content-box }` or `font-size: 62.5%` of theirs can deform
// the widget. Shadow DOM alone would not do it — inherited properties cross a
// shadow boundary, and the page's rules still apply to the host element.
//
// Sizing is NOT measured here. The loader (public/widget.js) owns the iframe's
// box and we only report which state we are in; it clamps to the viewport.
// That keeps the overlap contract in one place: closed, the iframe is exactly
// launcher-sized, so the widget intercepts clicks only where it is visible.
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WidgetPreview, useWidgetTheme } from './WebChatAppearance'
import { useFlowSimulation, renderFlowSimComposerControl } from './WebChatFlowBuilder'
import { useLiveConfig, SECTION_APPEARANCE, SECTION_FLOWS } from '../lib/liveConfig'
import { useVisitorCall } from '../hooks/useVisitorCall'
import { VisitorCallOverlay } from '../components/webchat/VisitorCallOverlay'

const DEFAULT_CFG = {
  colorMode: 'gradient', color: '#0066ff', colorEnd: '#8B5CF6',
  fontFamily: 'Inter', botName: 'ChatBot', tagline: 'We reply instantly',
  greeting: 'Hi! 👋 How can I help you today?',
  avatarStyle: 'icon', avatarEmoji: '🤖', avatarImage: '',
  showBranding: true, brandingUrl: '/', landingName: 'Support_Bot',
  borderLight: true,
}

const EMPTY_CONFIG = {}

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

/* Breathing room around the open panel, so the ambient bloom it casts (see
   wcBloom in WebChatAppearance.jsx) fades out naturally instead of being
   sliced off square at the iframe's edge. The panel is centred in the box, so
   this margin exists on all four sides without any padding. */
const GLOW_HALO = 44
/* Mirrors SIZE_PX in WebChatAppearance.jsx — the panel's width is fixed per
   size, and its height caps at the desktop shell maximum. */
const PANEL_W   = { compact: 340, standard: 384, large: 420 }
const PANEL_H   = 580

function openBox(cfg) {
  return {
    w: (PANEL_W[cfg.size] ?? PANEL_W.standard) + GLOW_HALO * 2,
    h: PANEL_H + GLOW_HALO * 2,
  }
}

export const EMBED_MESSAGE_NAMESPACE = 'chatflow-widget'

export default function WebChatEmbed() {
  const [params] = useSearchParams()
  const botId = params.get('id') || ''

  // Whole config in one subscription: both halves travel together, and a
  // single stream is one connection per visitor rather than two.
  const { cfg: config } = useLiveConfig(botId, EMPTY_CONFIG)
  const appearance = { ...DEFAULT_CFG, ...(config[SECTION_APPEARANCE] || {}) }
  const flows = Array.isArray(config[SECTION_FLOWS]) ? config[SECTION_FLOWS] : []
  // The merchant's entry-point automation. `kind: 'main'` is what the Flow
  // Builder marks it as; subflows are only reachable via goto_subflow.
  const mainFlow = flows.find(f => f.kind === 'main' && f.active !== false) || null

  return (
    <EmbedShell
      botId={botId}
      cfg={appearance}
      // Remounts the running conversation if the merchant republishes a
      // different flow — a visitor mid-conversation on a flow that no longer
      // exists is worse than a clean restart on the new one.
      key={mainFlow?.id || 'no-flow'}
      flow={mainFlow}
      allFlows={flows}
    />
  )
}

/**
 * Split from the component above so `useFlowSimulation` is called with a
 * settled flow. Hooks must run unconditionally, and the flow arrives
 * asynchronously — putting the simulation in a child keyed by flow id keeps
 * every hook call unconditional while still letting the engine restart when
 * the merchant publishes a different automation.
 */
function EmbedShell({ botId, cfg, flow, allFlows }) {
  const [screen, setScreen] = useState('closed')
  const [activeTab, setActiveTab] = useState('home')
  const [visitorId] = useState(() => getOrCreateVisitorId(botId))
  const { cornerR, fs, dark } = useWidgetTheme(cfg)

  const call = useVisitorCall(visitorId)

  /* The merchant's real automation, running for a real visitor — the same
     engine the Flow Builder's canvas preview and Live Preview use, so what
     they test is exactly what their website serves. */
  const sim = useFlowSimulation(flow, allFlows)
  const hasFlow = Boolean(flow)

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
    const box = open ? openBox(cfg) : (cfg.launcherText ? CLOSED_TEXT_BOX : CLOSED_BOX)
    post({ type: 'state', open, w: box.w, h: box.h })
  }, [screen, cfg.launcherText, cfg.size, post])

  /* ChatFlow('open') on the host page reaches the widget through here. Only
     our own namespace is honoured; a page full of other embeds posting
     messages is normal and none of it is for us. */
  useEffect(() => {
    function onMessage(e) {
      if (!e.data || e.data.__chatflow !== EMBED_MESSAGE_NAMESPACE) return
      if (e.data.type === 'open') setScreen(s => (s === 'closed' ? 'chat' : s))
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

  /* Without a published flow the widget still renders — design, tabs, calling
     all work — it just has no scripted conversation to run. Handing
     WidgetPreview an empty simThread here would instead blank the chat screen
     entirely, which looks broken rather than unconfigured. */
  const simComposerBanner = hasFlow && sim.ended
    ? { text: 'This conversation has ended', actionLabel: '↻ Start over', onAction: sim.reset }
    : null
  const simComposerControl = hasFlow && sim.awaiting
    ? renderFlowSimComposerControl({
        awaiting: sim.awaiting, submitAsk: sim.submitAsk,
        pickQuickReply: sim.pickQuickReply, pickBranch: sim.pickBranch,
        accent: cfg.color, dark, cornerR, fs,
        quickReplyStyle: cfg.quickReplyStyle, googleMapsApiKey: cfg.googleMapsApiKey,
      })
    : null

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: 'transparent' }}>
      {/* No padding: WidgetPreview centres the panel in whatever box it gets, so
          the box being GLOW_HALO bigger than the panel IS the halo margin. */}
      <div className="w-full h-full">
        <WidgetPreview cfg={cfg} screen={screen} device="desktop"
          activeTab={activeTab} setActiveTab={setActiveTab} setScreen={setScreen}
          simThread={hasFlow ? sim.messages : undefined}
          simComposerBanner={simComposerBanner}
          simComposerControl={simComposerControl}
          onRestartChat={hasFlow ? sim.reset : undefined}
          onVoiceCall={() => call.callAgent(false)}
          onVideoCall={() => call.callAgent(true)}/>
      </div>
      {open && <VisitorCallOverlay call={call} cfg={cfg} />}
    </div>
  )
}

/* Same shape as WebChatLandingPage's visitor identity, keyed per bot so two
   ChatFlow widgets on one browser don't share a thread.

   Third-party storage is the interesting case: inside an iframe on someone
   else's domain this is partitioned, and in Safari or with third-party cookies
   blocked it throws outright. A per-load id is the correct fallback — calling
   and the conversation still work for this page view, they just don't persist
   across reloads, which is far better than throwing on mount. */
function getOrCreateVisitorId(botId) {
  const key = `chatflow_visitor_${botId || 'default'}`
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
