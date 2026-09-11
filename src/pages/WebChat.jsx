// WebChat.jsx — the "Automation" nav entry for the Web Chat channel. Unlike
// Instagram's three-tab Automations section (Quick Automations / Flows /
// Rules), Web Chat's Automations page is just the flow canvas: quick
// trigger→reply automations are now a node TYPE on that canvas ("Quick
// Automation", see WebChatFlowBuilder.jsx) rather than a separate section,
// and there's no standing-rules concept here. Widget appearance/question
// types/settings live in WebChatAppearance.jsx (nav: "Appearance"), and
// install instructions live in the shared Installation.jsx page (nav:
// "Installation").
import { Zap } from 'lucide-react'
import WebChatFlowBuilder from './WebChatFlowBuilder'

/* ─── page shell ────────────────────────────────────────────────────────── */
export default function WebChat() {
  return (
    <div className="space-y-5 h-[calc(100vh-90px)] flex flex-col">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary/10 flex items-center justify-center flex-shrink-0">
          <Zap size={18} className="text-primary"/>
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-slate-900">Automations</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Build your bot's conversation flow — one Main Flow, with Subflows for anything more than a couple of steps.</p>
        </div>
      </div>

      <div className="flex-1 min-h-0"><WebChatFlowBuilder/></div>
    </div>
  )
}
