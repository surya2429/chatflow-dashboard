// WebChatFlowLivePreview.jsx — the real, standalone full-page URL behind the
// canvas's "Live Preview" toolbar button (see openLivePreview in
// WebChatFlowBuilder.jsx). Unlike /webchat-landing (a merchant's generic,
// static hosted-widget demo with no flow logic at all — see
// WebChatLandingPage.jsx), this route actually RUNS the SPECIFIC flow that
// was open in the canvas — the exact same useFlowSimulation engine
// PreviewSimulator's popup runs, just rendered as a real full page instead
// of a small dashboard-corner popup. Standalone/unauthenticated, no
// MainLayout, since the whole point is a real new-tab test of the bot.
//
// The canvas has no server-side place to hand "the flow currently open,
// including unsaved edits" off to a brand new tab, so it goes through
// localStorage (FLOW_PREVIEW_STORAGE_KEY) exactly the way
// WIDGET_CFG_STORAGE_KEY already bridges merchant branding to
// /webchat-landing.
import { useState, useEffect } from 'react'
import { MessageSquareText } from 'lucide-react'
import { WidgetPreview, useWidgetTheme } from './WebChatAppearance'
import { useFlowSimulation, renderFlowSimComposerControl, useWidgetCfg, FLOW_PREVIEW_STORAGE_KEY, recordFlowTestTurn } from './WebChatFlowBuilder'

function EmptyState() {
  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-sm text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
          <MessageSquareText size={20} className="text-slate-400"/>
        </div>
        <h1 className="text-base font-bold text-slate-800">No flow to preview</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          This page runs the specific flow that's open in the Flow Builder canvas. Go back to Website Chat →
          Automations, open a flow, and click "Live Preview" in the toolbar — it opens a fresh tab pointed at
          this page with that flow loaded.
        </p>
      </div>
    </div>
  )
}

// The actual running preview — split into its own component so
// useFlowSimulation (a hook) is only ever called once a real flow payload
// is known to exist, keeping hook calls unconditional.
function LiveFlowPreview({ flow, allFlows }) {
  const cfg = useWidgetCfg()
  const { cornerR, fs, dark } = useWidgetTheme(cfg)
  const { messages, awaiting, ended, reset, submitAsk, pickQuickReply, pickBranch } = useFlowSimulation(flow, allFlows)

  // This standalone tab has no ConversationContext (it's outside the
  // authenticated app entirely) to push straight into the Inbox, so it
  // hands the running transcript off via localStorage instead — the
  // dashboard tab, if open, picks this up as a `storage` event and upserts
  // it (see ConversationContext.jsx), the same cross-tab bridge pattern
  // FLOW_PREVIEW_STORAGE_KEY already uses in the other direction.
  useEffect(() => {
    // recordFlowTestTurn snapshots this thread's already-persisted history
    // the instant a run (re)starts (messages.length === 0 — initial mount,
    // a restart, or reopening this tab after closing it) so restarting
    // never erases what was captured before; see its comment for why.
    recordFlowTestTurn(flow, messages, 'live')
  }, [messages, flow])

  const simComposerBanner = ended ? { text: 'This simulation has ended', actionLabel: '↻ Restart', onAction: reset } : null
  const simComposerControl = awaiting
    ? renderFlowSimComposerControl({ awaiting, submitAsk, pickQuickReply, pickBranch, accent: cfg.color, dark, cornerR, fs, quickReplyStyle: cfg.quickReplyStyle, googleMapsApiKey: cfg.googleMapsApiKey })
    : null

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md h-[85vh] max-h-[680px] flex flex-col relative">
        {/* No separate restart button floating outside the frame — the
            widget's own header already has one ("Restart chat" in the
            More-options "⋯" menu, wired via onRestartChat below). A second,
            disconnected icon hovering above the card just reads as a stray
            unexplained control on a full page with no popup chrome around
            it to give it context. */}
        <WidgetPreview cfg={cfg} screen="open" device="desktop"
          activeTab="chat" setActiveTab={() => {}}
          simThread={messages} simComposerBanner={simComposerBanner}
          simComposerControl={simComposerControl}
          onRestartChat={reset}/>
      </div>
    </div>
  )
}

export default function WebChatFlowLivePreview() {
  const [payload, setPayload] = useState(undefined) // undefined = still loading, null = missing/invalid

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(FLOW_PREVIEW_STORAGE_KEY) || 'null')
      if (raw && raw.flow && raw.flow.graph && Array.isArray(raw.flow.graph.nodes)) setPayload(raw)
      else setPayload(null)
    } catch {
      setPayload(null)
    }
  }, [])

  if (payload === undefined) return null
  if (!payload) return <EmptyState/>
  return <LiveFlowPreview flow={payload.flow} allFlows={payload.allFlows || []}/>
}
