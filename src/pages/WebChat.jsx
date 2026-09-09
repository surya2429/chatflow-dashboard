// WebChat.jsx — the "Automation" nav entry for the Web Chat channel. Mirrors
// InstagramAutomations.jsx's three-tab shape (Quick Automations / Flows /
// Rules) so all three channels' Automation sections read the same way, minus
// whatever doesn't apply to this channel: no comment/DM/story-reply sources
// (website chat only has one "conversation" concept), no follow-gate. Widget
// appearance/question types/settings live in WebChatAppearance.jsx (nav:
// "Appearance"), and install instructions live in the shared Installation.jsx
// page (nav: "Installation").
import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Zap, Layers, Menu as MenuIcon, Info, Hash, Link2, LogOut, Clock, UserCheck,
  MessageSquareText, X,
} from 'lucide-react'
import clsx from 'clsx'
import {
  SegmentedTabs, RuleStatsBar, RuleToolbar, RuleCard, EmptyState,
  TemplateGallery, BulkActionsMenu, Toggle, KeywordInput, FrequencyCapField, AIReplyConfig,
} from '../components/instagram/shared'
import WebChatFlowBuilder from './WebChatFlowBuilder'

/* ─── Quick Automation rules — website-chat triggers instead of Instagram's
   comment/DM/story-reply sources: a keyword in the visitor's message, a page
   they're on, exit intent, idle time, or being a returning visitor (the
   visitorId identity already used for inbox/contacts threading). ── */
export const TRIGGER_META = {
  keyword:            { label: 'Keyword',           icon: Hash,             color: 'text-primary bg-primary-50 border-primary/10' },
  page:               { label: 'Page Visited',      icon: Link2,            color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  exit_intent:        { label: 'Exit Intent',        icon: LogOut,           color: 'text-red-600 bg-red-50 border-red-100' },
  idle:               { label: 'Idle on Page',       icon: Clock,            color: 'text-amber-600 bg-amber-50 border-amber-100' },
  returning_visitor:  { label: 'Returning Visitor',  icon: UserCheck,        color: 'text-violet-600 bg-violet-50 border-violet-100' },
}

export const INITIAL_QUICK_RULES = [
  { id: 'wa1', name: 'Pricing questions → send plans', active: true,
    trigger: 'keyword', keywords: ['price', 'pricing', 'cost', 'plans'], matchMode: 'any', pageUrl: '', idleSeconds: 30,
    reply: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Here's an overview of our plans — Starter, Growth, and Enterprise. Want me to send the full pricing page?" },
    frequencyCap: '24h', stats: { triggered: 486, trend7d: 12 } },
  { id: 'wa2', name: 'Refund policy quick answer', active: true,
    trigger: 'keyword', keywords: ['refund', 'return', 'money back'], matchMode: 'any', pageUrl: '', idleSeconds: 30,
    reply: { aiEnabled: true, instructions: 'Mention the 14-day window and link to the refund policy page.', useGlobalKb: true, docs: [], message: '' },
    frequencyCap: '24h', stats: { triggered: 152, trend7d: 6 } },
  { id: 'wa3', name: 'Checkout exit-intent save', active: true,
    trigger: 'exit_intent', keywords: [], matchMode: 'any', pageUrl: '/checkout', idleSeconds: 30,
    reply: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Leaving already? If anything's holding you back — pricing, a question, whatever — I'm right here 👋" },
    frequencyCap: '7d', stats: { triggered: 97, trend7d: -3 } },
  { id: 'wa4', name: 'Nudge idle visitors on pricing', active: false,
    trigger: 'idle', keywords: [], matchMode: 'any', pageUrl: '/pricing', idleSeconds: 45,
    reply: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: 'Still comparing plans? Happy to help you pick the right one — just ask!' },
    frequencyCap: '24h', stats: { triggered: 61, trend7d: 9 } },
  { id: 'wa5', name: 'Welcome back returning visitors', active: true,
    trigger: 'returning_visitor', keywords: [], matchMode: 'any', pageUrl: '', idleSeconds: 30,
    reply: { aiEnabled: true, instructions: 'Greet them warmly and ask if they have new questions since last time.', useGlobalKb: true, docs: [], message: '' },
    frequencyCap: 'none', stats: { triggered: 203, trend7d: 15 } },
]

const QUICK_TEMPLATES = [
  { name: 'Answer pricing questions', emoji: '💰', desc: 'Keyword "price" → AI reply with plan info',            trigger: 'keyword', keywords: ['price', 'pricing'], aiEnabled: true },
  { name: 'Catch cart abandoners',    emoji: '🛒', desc: 'Exit intent on /checkout → offer help before they leave', trigger: 'exit_intent', pageUrl: '/checkout' },
  { name: 'Welcome back',             emoji: '👋', desc: 'Returning visitor → personalized greeting',              trigger: 'returning_visitor', aiEnabled: true },
  { name: 'Nudge idle visitors',      emoji: '⏱️', desc: '30s idle on any page → proactive check-in',              trigger: 'idle', idleSeconds: 30 },
]

function ruleSubtitle(r) {
  const meta = TRIGGER_META[r.trigger]
  if (r.trigger === 'keyword') return r.keywords.length ? `Keyword: ${r.keywords.join(', ')}` : 'Any message'
  if (r.trigger === 'page') return r.pageUrl ? `Page: ${r.pageUrl}` : 'Any page'
  if (r.trigger === 'exit_intent') return r.pageUrl ? `Exit intent on ${r.pageUrl}` : 'Exit intent on any page'
  if (r.trigger === 'idle') return `${r.idleSeconds}s idle${r.pageUrl ? ` on ${r.pageUrl}` : ''}`
  if (r.trigger === 'returning_visitor') return 'Any returning visitor'
  return meta?.label || r.trigger
}

function triggerThumb(r) {
  const meta = TRIGGER_META[r.trigger]
  const Icon = meta?.icon || Hash
  return (
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}>
      <Icon size={18} className="text-indigo-300"/>
    </div>
  )
}

function newRuleDraft() {
  return {
    id: `wa${Date.now()}`, name: '', active: true,
    trigger: 'keyword', keywords: [], matchMode: 'any', pageUrl: '', idleSeconds: 30,
    reply: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: '' },
    frequencyCap: '24h', stats: { triggered: 0, trend7d: 0 },
  }
}

/* ─── Editor modal — simpler than Instagram's QuickAutomationWizard since
   website-chat triggers have no comment/DM/story/follow-gate concepts to
   configure. ── */
function RuleEditorModal({ rule, onClose, onSave }) {
  const [draft, setDraft] = useState(rule)
  function set(k, v) { setDraft(p => ({ ...p, [k]: v })) }
  const canSave = draft.name.trim().length > 0

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-modal animate-fade-in overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{rule.name ? 'Edit Automation' : 'New Automation'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Trigger a reply when a website visitor matches this condition.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-slate-600 transition-colors"><X size={16}/></button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="label">Name</label>
            <input className="input mt-1" value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Pricing questions → send plans"/>
          </div>

          <div>
            <label className="label mb-1.5 block">Trigger</label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(TRIGGER_META).map(([key, meta]) => (
                <button key={key} onClick={() => set('trigger', key)}
                  className={clsx('flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-[10.5px] font-semibold transition-all',
                    draft.trigger === key ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:border-slate-300')}>
                  <meta.icon size={14}/>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {draft.trigger === 'keyword' && (
            <div>
              <label className="label mb-1.5 block">Keywords</label>
              <KeywordInput keywords={draft.keywords} onChange={v => set('keywords', v)}/>
            </div>
          )}

          {(draft.trigger === 'page' || draft.trigger === 'exit_intent' || draft.trigger === 'idle') && (
            <div>
              <label className="label">Page URL <span className="text-slate-400 font-normal">(optional — leave blank for any page)</span></label>
              <input className="input mt-1" value={draft.pageUrl} onChange={e => set('pageUrl', e.target.value)} placeholder="/checkout"/>
            </div>
          )}

          {draft.trigger === 'idle' && (
            <div>
              <label className="label">Idle threshold (seconds)</label>
              <input type="number" min={5} className="input mt-1 w-32" value={draft.idleSeconds}
                onChange={e => set('idleSeconds', Math.max(5, +e.target.value || 5))}/>
            </div>
          )}

          <div className="border-t border-surface-border pt-3.5">
            <label className="label mb-1.5 block">Reply</label>
            <AIReplyConfig config={draft.reply} onChange={v => set('reply', v)} messagePlaceholder="Type the reply the bot should send…"/>
          </div>

          <FrequencyCapField value={draft.frequencyCap} onChange={v => set('frequencyCap', v)}/>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
          <button onClick={() => canSave && onSave(draft)} disabled={!canSave}
            className={clsx('flex-1 justify-center text-sm', canSave ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}>
            Save Automation
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Quick Automations tab ────────────────────────────────────────────── */
function QuickAutomationsTab() {
  const [rules, setRules] = useState(INITIAL_QUICK_RULES)
  const [modal, setModal] = useState(null) // null | draft rule object
  const [showTemplates, setShowTemplates] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('priority')

  function toggle(id, v) { setRules(r => r.map(x => x.id === id ? { ...x, active: v } : x)) }
  function remove(id) { setRules(r => r.filter(x => x.id !== id)) }
  function duplicate(rule) { setRules(r => [...r, { ...rule, id: `wa${Date.now()}`, name: `${rule.name} (copy)`, active: false, stats: { triggered: 0, trend7d: 0 } }]) }
  function save(draft) {
    setRules(r => r.some(x => x.id === draft.id) ? r.map(x => x.id === draft.id ? draft : x) : [...r, draft])
    setModal(null)
  }
  function useTemplate(t) {
    setShowTemplates(false)
    setModal({
      ...newRuleDraft(),
      name: t.name, trigger: t.trigger,
      keywords: t.keywords || [], pageUrl: t.pageUrl || '', idleSeconds: t.idleSeconds || 30,
      reply: { aiEnabled: !!t.aiEnabled, instructions: '', useGlobalKb: true, docs: [], message: '' },
    })
  }

  const visibleRules = useMemo(() => {
    let list = rules.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    if (sort === 'triggered') list = [...list].sort((a, b) => b.stats.triggered - a.stats.triggered)
    else if (sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [rules, search, sort])

  const stats = [
    { label: 'Total Rules',     value: rules.length,                                        icon: Layers,  color: '#0066ff' },
    { label: 'Active',          value: rules.filter(r => r.active).length,                   icon: Zap,     color: '#10B981' },
    { label: 'Triggered (30d)', value: rules.reduce((s, r) => s + r.stats.triggered, 0).toLocaleString(), icon: MessageSquareText, color: '#8B5CF6' },
    { label: 'Returning-Visitor Rules', value: rules.filter(r => r.trigger === 'returning_visitor').length, icon: UserCheck, color: '#14B8A6' },
  ]

  return (
    <div className="space-y-4">
      <RuleStatsBar stats={stats}/>
      <RuleToolbar search={search} onSearch={setSearch} sort={sort} onSort={setSort}
        onTemplates={() => setShowTemplates(true)} onNew={() => setModal(newRuleDraft())} newLabel="New Automation"
        bulk={<BulkActionsMenu total={rules.length} activeCount={rules.filter(r => r.active).length}
          onPauseAll={() => setRules(r => r.map(x => ({ ...x, active: false })))}
          onEnableAll={() => setRules(r => r.map(x => ({ ...x, active: true })))}/>}/>

      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {visibleRules.map(r => {
          const meta = TRIGGER_META[r.trigger]
          const badges = [{ label: meta.label, icon: meta.icon, className: meta.color }]
          return (
            <RuleCard key={r.id} rule={r} aiEnabled={r.reply?.aiEnabled} subtitle={ruleSubtitle(r)} badges={badges} thumb={triggerThumb(r)}
              onToggle={toggle} onEdit={rule => setModal(rule)} onDelete={remove} onDuplicate={duplicate}
              onOpen={rule => setModal(rule)}/>
          )
        })}
        {visibleRules.length === 0 && (
          <EmptyState icon={Zap} title={search ? `No automations match "${search}"` : 'No quick automations yet'}
            sub={search ? 'Try a different search term.' : 'Start from a template or build your own.'}
            action={!search && <button onClick={() => setShowTemplates(true)} className="btn-secondary">Browse Templates</button>}/>
        )}
      </div>

      {modal && <RuleEditorModal rule={modal} onClose={() => setModal(null)} onSave={save}/>}
      {showTemplates && (
        <TemplateGallery title="Quick Automation Templates" templates={QUICK_TEMPLATES} onUse={useTemplate} onClose={() => setShowTemplates(false)}/>
      )}
    </div>
  )
}

/* ─── Rules tab — always-on, account-wide behaviors, no keyword to configure —
   business-hours/offline fallback, mirroring Instagram's Story Mention rule
   in shape (a short toggle list) but with webchat-appropriate rules. ── */
const INITIAL_STANDING_RULES = [
  { id: 'wr1', name: 'Auto-reply outside business hours', active: true,
    reply: { aiEnabled: false, message: "We're offline right now — we'll get back to you within a few hours!" },
    stats: { triggered: 214 } },
  { id: 'wr2', name: 'All agents offline → bot-only fallback', active: true,
    reply: { aiEnabled: true, message: '' },
    stats: { triggered: 58 } },
  { id: 'wr3', name: 'Missed-chat follow-up email', active: false,
    reply: { aiEnabled: false, message: "Sorry we missed you! Reply here or email us anytime." },
    stats: { triggered: 12 } },
]

function RulesTab() {
  const [rules, setRules] = useState(INITIAL_STANDING_RULES)
  function toggle(id, v) { setRules(r => r.map(x => x.id === id ? { ...x, active: v } : x)) }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex items-start gap-2.5">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-[12px] font-semibold text-slate-700">What's the difference between Rules and Quick Automations?</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            <span className="font-semibold text-slate-600">Quick Automations</span> (previous tab) reply to a <span className="font-semibold text-slate-600">specific</span> trigger — a keyword, a page, exit intent, idle time.
            <span className="font-semibold text-slate-600"> Rules</span> are <span className="font-semibold text-slate-600">always-on, widget-wide</span> behaviors with no condition to configure — business hours, offline fallback, missed-chat follow-up.
          </p>
        </div>
      </div>

      <div className="bg-white border border-surface-border rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0"><MenuIcon size={16} className="text-cyan-600"/></div>
          <div>
            <p className="text-[12px] font-semibold text-slate-800">Standing Rules</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Always active — no per-rule condition, just on or off.</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-border">
              <div className="min-w-0 pr-3">
                <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">{r.name}
                  {r.reply.aiEnabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 flex-shrink-0">AI</span>}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{r.stats.triggered.toLocaleString()} triggered</p>
              </div>
              <Toggle checked={r.active} onChange={v => toggle(r.id, v)}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── page shell ────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'quick', label: 'Quick Automations', icon: Zap,      color: '#0066ff' },
  { id: 'flows', label: 'Flows',             icon: Layers,   color: '#7c3aed' },
  { id: 'rules', label: 'Rules',             icon: MenuIcon, color: '#0891b2' },
]

export default function WebChat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = ['flows', 'rules'].includes(tabParam) ? tabParam : 'quick'
  const [tab, setTab] = useState(initialTab)

  function changeTab(id) { setTab(id); setSearchParams(id === 'quick' ? {} : { tab: id }) }

  return (
    <div className={clsx('space-y-5', tab === 'flows' && 'h-[calc(100vh-90px)] flex flex-col')}>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary/10 flex items-center justify-center flex-shrink-0">
          <Zap size={18} className="text-primary"/>
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-slate-900">Automations</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Quick trigger→reply automations, multi-step flows, and standing rules — all in one place.</p>
        </div>
      </div>

      <SegmentedTabs tabs={TABS} active={tab} onChange={changeTab}/>

      {tab === 'quick' && <QuickAutomationsTab/>}
      {tab === 'flows' && <div className="flex-1 min-h-0"><WebChatFlowBuilder/></div>}
      {tab === 'rules' && <RulesTab/>}
    </div>
  )
}
