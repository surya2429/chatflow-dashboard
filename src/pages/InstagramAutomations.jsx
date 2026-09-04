import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Zap, Layers, Radio, UserCheck, Send, MessageSquare, Camera, AtSign,
  Menu as MenuIcon, Info,
} from 'lucide-react'
import clsx from 'clsx'
import {
  SegmentedTabs, RuleStatsBar, RuleToolbar, RuleCard, ContentThumb, EmptyState,
  TemplateGallery, BulkActionsMenu, Toggle, MOCK_POSTS, MOCK_STORIES,
} from '../components/instagram/shared'
import QuickAutomationWizard from '../components/instagram/QuickAutomationWizard'
import AutomationDetailModal from '../components/instagram/AutomationDetailModal'
import InstagramFlowBuilder from './InstagramFlowBuilder'

/* ─── unified Quick Automation rules — merges DM + Comment + Story Reply ──
   Comment-sourced rules run the full ManyChat-style comment-to-DM funnel:
   Opening DM (with a button) → optional Follow-Gate → DM with the link,
   plus an "Other things to automate" checklist (public reply variants,
   ask-for-email, follow-up nudge). Other sources just use aiConfig. ── */
export const INITIAL_QUICK_RULES = [
  { id: 'qa1', name: 'Comment "price" → DM the price list', active: true, source: 'comment', targetScope: 'all', targetIds: [],
    keywords: ['price', 'cost', 'how much'], matchMode: 'any',
    openingDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Hey there! I'm so happy you're here 😊 Click below and I'll send you our price list in just a sec ✨", buttonLabel: 'Send me the price list' },
    linkDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Here's our full price list 👉", url: 'acme.shop/pricing', buttonLabel: 'Open' },
    publicReplyEnabled: true, publicReplies: ['Sent you a DM! 📩', 'Check your DMs! 💌', "It's in your inbox! 📬"],
    publicReplyConfig: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [] },
    askEmailEnabled: false,
    commentFollowGate: { enabled: true, promptMessage: "Nearly there! Follow us and I'll send the price list right away 🎉" },
    followUpEnabled: true, followUpMessage: "Still curious about pricing? The link is waiting for you 👀",
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: '24h',
    stats: { triggered: 431, trend7d: 14 } },
  { id: 'qa2', name: 'Pricing questions', active: true, source: 'dm', targetScope: 'all', targetIds: [],
    keywords: ['price', 'pricing', 'cost'], matchMode: 'any',
    aiConfig: { aiEnabled: true, instructions: '', useGlobalKb: true, docs: [], message: '' },
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: '24h',
    stats: { triggered: 214, trend7d: 8 } },
  { id: 'qa3', name: 'First message welcome', active: true, source: 'dm', targetScope: 'all', targetIds: [],
    keywords: [], matchMode: 'any',
    aiConfig: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: 'Hey! 👋 Thanks for reaching out — what can I help with?' },
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: 'none',
    stats: { triggered: 892, trend7d: 11 } },
  { id: 'qa4', name: 'Product question auto-reply', active: true, source: 'comment', targetScope: 'specific', targetIds: ['p1'],
    keywords: ['size', 'available'], matchMode: 'any',
    openingDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: 'Hey! Thanks for asking 😊 Tap below and I\'ll send you the details.', buttonLabel: 'Send me the details' },
    linkDM: { aiEnabled: true, instructions: '', useGlobalKb: true, docs: [], message: 'Here are the sizes we have in stock:', url: '', buttonLabel: 'View sizes' },
    publicReplyEnabled: false, publicReplies: ['Sent you a DM! 📩'],
    publicReplyConfig: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [] },
    askEmailEnabled: false, commentFollowGate: { enabled: false, promptMessage: '' },
    followUpEnabled: false, followUpMessage: '',
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: 'none',
    stats: { triggered: 88, trend7d: 5 } },
  { id: 'qa5', name: 'Auto-reply to story replies', active: true, source: 'story_reply', targetScope: 'all', targetIds: [],
    keywords: [], matchMode: 'any',
    aiConfig: { aiEnabled: true, instructions: '', useGlobalKb: true, docs: [], message: '' },
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: '24h',
    stats: { triggered: 147, trend7d: 9 } },
]

export const SOURCE_META = {
  dm:           { label: 'DM',           icon: Send,          color: 'text-primary bg-primary-50 border-primary/10' },
  comment:      { label: 'Comment',      icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  story_reply:  { label: 'Story Reply',  icon: Camera,        color: 'text-pink-600 bg-pink-50 border-pink-100' },
}

const QUICK_TEMPLATES = [
  { name: 'Comment → DM the link',   emoji: '🔗', desc: 'Comment "LINK" → Opening DM + button → DM the link, with Follow-Gate', source: 'comment', keywords: ['link'], followGate: true },
  { name: 'Price list on request',   emoji: '💰', desc: 'DM "price" → AI reply with pricing info',                             source: 'dm', keywords: ['price', 'cost'], aiEnabled: true },
  { name: 'Giveaway entry',          emoji: '🎁', desc: 'Any comment → public reply + DM confirming entry',                     source: 'comment', keywords: [], followGate: true, publicReply: true },
  { name: 'Welcome new followers',   emoji: '👋', desc: 'First DM → quick welcome message',                                     source: 'dm', keywords: [], message: 'Hey! 👋 What can I help with?' },
  { name: 'Poll follow-up',          emoji: '📊', desc: 'Story reply → AI asks a follow-up question',                           source: 'story_reply', keywords: [] },
]

function ruleSubtitle(r) {
  const src = SOURCE_META[r.source]?.label || r.source
  if (r.source === 'comment') {
    const scope = r.targetScope === 'all' ? 'All posts' : `${r.targetIds.length} post${r.targetIds.length === 1 ? '' : 's'}`
    const actions = ['Opening DM', r.publicReplyEnabled && 'public reply', r.commentFollowGate?.enabled && 'Follow-Gate', r.followUpEnabled && 'follow-up'].filter(Boolean).join(' + ')
    return `${scope} · ${r.keywords.length ? r.keywords.join(', ') : 'any comment'} · ${actions}`
  }
  if (r.source === 'story_reply') {
    return r.targetScope === 'all' ? 'All stories' : `${r.targetIds.length} stor${r.targetIds.length === 1 ? 'y' : 'ies'} selected`
  }
  return r.keywords.length ? `Keyword: ${r.keywords.join(', ')}` : `Triggers on any ${src.toLowerCase()}`
}

/* ─── Quick Automations tab ────────────────────────────────────────────── */
function QuickAutomationsTab() {
  const [rules, setRules] = useState(INITIAL_QUICK_RULES)
  const [modal, setModal] = useState(null) // null | 'new' | rule
  const [detailRule, setDetailRule] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('priority')

  function toggle(id, v) { setRules(r => r.map(x => x.id === id ? { ...x, active: v } : x)) }
  function remove(id) { setRules(r => r.filter(x => x.id !== id)) }
  function duplicate(rule) { setRules(r => [...r, { ...rule, id: `qa${Date.now()}`, name: `${rule.name} (copy)`, active: false, stats: { triggered: 0, trend7d: 0 } }]) }
  function save(draft) {
    setRules(r => r.some(x => x.id === draft.id) ? r.map(x => x.id === draft.id ? draft : x) : [...r, draft])
    setModal(null)
  }
  function useTemplate(t) {
    setShowTemplates(false)
    if (t.source === 'comment') {
      setModal({
        id: `qa${Date.now()}`, name: t.name, active: true, source: 'comment', targetScope: 'all', targetIds: [],
        keywords: t.keywords || [], matchMode: 'any',
        openingDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Hey there! I'm so happy you're here 😊 Click below and I'll send it right over ✨", buttonLabel: 'Send it to me' },
        linkDM: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [], message: "Here you go 👉", url: '', buttonLabel: 'Open' },
        publicReplyEnabled: !!t.publicReply, publicReplies: ['Sent you a DM! 📩'],
        publicReplyConfig: { aiEnabled: false, instructions: '', useGlobalKb: true, docs: [] },
        askEmailEnabled: false,
        commentFollowGate: { enabled: !!t.followGate, promptMessage: t.followGate ? "Nearly there! Follow us and I'll send it right away 🎉" : '' },
        followUpEnabled: false, followUpMessage: '',
        followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: 'none',
        stats: { triggered: 0, trend7d: 0 },
      })
      return
    }
    setModal({
      id: `qa${Date.now()}`, name: t.name, active: true, source: t.source, targetScope: 'all', targetIds: [],
      keywords: t.keywords || [], matchMode: 'any',
      aiConfig: { aiEnabled: !!t.aiEnabled, instructions: '', useGlobalKb: true, docs: [], message: t.message || '' },
      followGate: { enabled: !!t.followGate, nudgeMessage: t.followGate ? 'Follow us and comment again to get the link! 🔗' : '' }, frequencyCap: 'none',
      stats: { triggered: 0, trend7d: 0 },
    })
  }

  const visibleRules = useMemo(() => {
    let list = rules.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    if (sort === 'triggered') list = [...list].sort((a, b) => b.stats.triggered - a.stats.triggered)
    else if (sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [rules, search, sort])

  const stats = [
    { label: 'Total Rules',     value: rules.length,                                        icon: Layers,    color: '#0066ff' },
    { label: 'Active',          value: rules.filter(r => r.active).length,                   icon: Zap,       color: '#10B981' },
    { label: 'Triggered (30d)', value: rules.reduce((s, r) => s + r.stats.triggered, 0).toLocaleString(), icon: Radio, color: '#8B5CF6' },
    { label: 'Follow-Gated',    value: rules.filter(r => (r.source === 'comment' ? r.commentFollowGate?.enabled : r.followGate?.enabled)).length, icon: UserCheck, color: '#14B8A6' },
  ]

  return (
    <div className="space-y-4">
      <RuleStatsBar stats={stats}/>
      <RuleToolbar search={search} onSearch={setSearch} sort={sort} onSort={setSort}
        onTemplates={() => setShowTemplates(true)} onNew={() => setModal('new')} newLabel="New Automation"
        bulk={<BulkActionsMenu total={rules.length} activeCount={rules.filter(r => r.active).length}
          onPauseAll={() => setRules(r => r.map(x => ({ ...x, active: false })))}
          onEnableAll={() => setRules(r => r.map(x => ({ ...x, active: true })))}/>}/>

      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {visibleRules.map(r => {
          const src = SOURCE_META[r.source]
          const badges = [{ label: src.label, icon: src.icon, className: src.color }]
          const gated = r.source === 'comment' ? r.commentFollowGate?.enabled : r.followGate?.enabled
          if (gated) badges.push({ label: 'Follow-Gate', icon: UserCheck, className: 'bg-teal-50 text-teal-600 border-teal-200' })
          if (r.source === 'comment' && r.publicReplyEnabled) badges.push({ label: 'Public Reply', icon: MessageSquare, className: 'bg-slate-50 text-slate-500 border-slate-200' })
          const firstItem = r.source === 'comment' ? MOCK_POSTS.find(p => p.id === r.targetIds[0]) : r.source === 'story_reply' ? MOCK_STORIES.find(s => s.id === r.targetIds[0]) : null
          const thumb = r.source === 'dm'
            ? <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}><Send size={18} className="text-indigo-300"/></div>
            : <ContentThumb item={firstItem} scope={r.targetScope} kind={r.source === 'comment' ? 'post' : 'story'}/>
          const anyAi = r.source === 'comment' ? (r.openingDM?.aiEnabled || r.linkDM?.aiEnabled || r.publicReplyConfig?.aiEnabled) : r.aiConfig?.aiEnabled
          return (
            <RuleCard key={r.id} rule={r} aiEnabled={anyAi} subtitle={ruleSubtitle(r)} badges={badges} thumb={thumb}
              onToggle={toggle} onEdit={rule => setModal(rule)} onDelete={remove} onDuplicate={duplicate}
              onOpen={rule => setDetailRule(rule)}/>
          )
        })}
        {visibleRules.length === 0 && (
          <EmptyState icon={Zap} title={search ? `No automations match "${search}"` : 'No quick automations yet'}
            sub={search ? 'Try a different search term.' : 'Start from a template or build your own.'}
            action={!search && <button onClick={() => setShowTemplates(true)} className="btn-secondary">Browse Templates</button>}/>
        )}
      </div>

      {(modal === 'new' || modal) && (
        <QuickAutomationWizard rule={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={save}/>
      )}
      {showTemplates && (
        <TemplateGallery title="Quick Automation Templates" templates={QUICK_TEMPLATES} onUse={useTemplate} onClose={() => setShowTemplates(false)}/>
      )}
      {detailRule && (
        <AutomationDetailModal rule={detailRule} sourceMeta={SOURCE_META} onClose={() => setDetailRule(null)}
          onToggle={toggle} onEdit={rule => { setDetailRule(null); setModal(rule) }}/>
      )}
    </div>
  )
}

/* ─── Rules tab — Story Mention automation ───────────────────────────────
   Default Reply, Persistent Menu & Ice Breakers moved into the Flow Builder
   as "Ask Questions" node types (default_reply / persistent_menu / ice_breaker) —
   see InstagramFlowBuilder.jsx — so they can sit in an actual flow instead of
   being disconnected global settings. ── */
const INITIAL_MENTION_RULES = [
  { id: 'sm1', name: 'Thank fans who tag us', active: true,
    aiConfig: { aiEnabled: true, instructions: '', useGlobalKb: true, docs: [], message: '' },
    followGate: { enabled: false, nudgeMessage: '' }, frequencyCap: '7d',
    stats: { triggered: 63, trend7d: 6 } },
]

function RulesTab() {
  const [mentionRules, setMentionRules] = useState(INITIAL_MENTION_RULES)
  function toggle(id, v) { setMentionRules(r => r.map(x => x.id === id ? { ...x, active: v } : x)) }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex items-start gap-2.5">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-[12px] font-semibold text-slate-700">What's the difference between Rules and Quick Automations?</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            <span className="font-semibold text-slate-600">Quick Automations</span> (previous tab) reply to a <span className="font-semibold text-slate-600">specific</span> trigger — a keyword, a comment on one post, a story reply.
            <span className="font-semibold text-slate-600"> Rules</span> are <span className="font-semibold text-slate-600">always-on, account-wide</span> behaviors with no keyword to configure — right now that's just auto-thanking anyone who <span className="italic">mentions</span> you in their own story.
            Default Reply, Persistent Menu, and Ice Breakers now live as node types in the <span className="font-semibold text-slate-600">Flows</span> tab.
          </p>
        </div>
      </div>

      <div className="bg-white border border-surface-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0"><AtSign size={16} className="text-violet-600"/></div>
            <div>
              <p className="text-[12px] font-semibold text-slate-800">Story Mention Automation</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Auto-thanks anyone who tags your account in <span className="font-medium text-slate-500">their</span> story.
                Not to be confused with "Story Reply" in Quick Automations, which replies when someone responds to <span className="font-medium text-slate-500">your</span> story.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          {mentionRules.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-border">
              <div>
                <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">{r.name}
                  {r.aiConfig.aiEnabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">AI</span>}
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
  { id: 'quick', label: 'Quick Automations', icon: Zap,      color: '#E1306C' },
  { id: 'flows', label: 'Flows',             icon: Layers,   color: '#7c3aed' },
  { id: 'rules', label: 'Rules',             icon: MenuIcon, color: '#0891b2' },
]

export default function InstagramAutomations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = ['flows', 'rules'].includes(tabParam) ? tabParam : 'quick'
  const [tab, setTab] = useState(initialTab)

  function changeTab(id) { setTab(id); setSearchParams(id === 'quick' ? {} : { tab: id }) }

  return (
    <div className={clsx('space-y-5', tab === 'flows' && 'h-[calc(100vh-90px)] flex flex-col')}>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center flex-shrink-0">
          <Zap size={18} className="text-pink-600"/>
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-slate-900">Automations</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Quick trigger→reply automations, multi-step flows, and standing rules — all in one place.</p>
        </div>
      </div>

      <SegmentedTabs tabs={TABS} active={tab} onChange={changeTab}/>

      {tab === 'quick' && <QuickAutomationsTab/>}
      {tab === 'flows' && <div className="flex-1 min-h-0"><InstagramFlowBuilder/></div>}
      {tab === 'rules' && <RulesTab/>}
    </div>
  )
}
