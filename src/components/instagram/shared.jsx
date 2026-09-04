import { useState, useRef, useEffect } from 'react'
import {
  Sparkles, Upload, FileText, X, Plus, Trash2, Pencil, CheckCircle2, Check, Film,
  LayoutGrid, Grid3x3, Send, MessageCircle, Clock, Hash, AlertCircle, ExternalLink,
  Search, ArrowUpDown, LayoutTemplate, UserCheck, TrendingUp, ChevronUp, ChevronDown,
  Smartphone, EyeOff, Copy, PauseCircle, PlayCircle, GitBranch, Shuffle, Link2, Variable,
  Calendar, MapPin, Globe, ListChecks, Package, CreditCard, MoreHorizontal, SlidersHorizontal, Heart,
  Users, Repeat2, TrendingDown, User, Star, HelpCircle, Contact,
} from 'lucide-react'
import clsx from 'clsx'
import { NativeSelect } from '../Select'

/* ─── shared bits used across every Instagram automation surface ────────── */

export function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative',
      background: checked ? 'rgb(var(--accent))' : '#d1d5db', transition: 'background 0.2s', padding: 0, flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

/* Content library — mirrors what a real "select posts" picker (à la ManyChat's Comment    */
/* Growth Tool) would pull from the connected IG account, incl. "All Posts" as a fast-path. */
export const MOCK_POSTS = [
  { id: 'p1', type: 'reel', emoji: '🎬', caption: 'Summer Collection Reel',        likes: '12.4K', comments: 842 },
  { id: 'p2', type: 'post', emoji: '🛍️', caption: 'New drop — link in bio',        likes: '8.1K',  comments: 301 },
  { id: 'p3', type: 'reel', emoji: '✨', caption: 'Behind the scenes',              likes: '5.6K',  comments: 198 },
  { id: 'p4', type: 'post', emoji: '📦', caption: 'Unboxing our best-seller',       likes: '9.9K',  comments: 460 },
  { id: 'p5', type: 'post', emoji: '🎉', caption: 'Giveaway announcement',          likes: '21.2K', comments: 1830 },
  { id: 'p6', type: 'reel', emoji: '💡', caption: '3 styling tips',                 likes: '4.3K',  comments: 122 },
]

export const MOCK_STORIES = [
  { id: 'st1', emoji: '🏷️', caption: 'Flash sale — 24h only', postedAt: '2h ago',  views: '3.1K' },
  { id: 'st2', emoji: '❓', caption: 'Poll: which color?',      postedAt: '5h ago',  views: '2.4K' },
  { id: 'st3', emoji: '📸', caption: 'Customer feature',         postedAt: '9h ago',  views: '1.8K' },
]

/* ─── overflow "⋯" menu — Edit / Duplicate / Delete in one place ─────── */
export function KebabMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => setOpen(p => !p)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <MoreHorizontal size={14}/>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-surface-border rounded-xl shadow-modal z-30 py-1 overflow-hidden" onClick={() => setOpen(false)}>
          {items.map(it => (
            <button key={it.label} onClick={it.onClick}
              className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-surface-hover', it.danger ? 'text-red-500' : 'text-slate-600')}>
              <it.icon size={12}/>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── generic rule card ──────────────────────────────────────── */
export function RuleCard({ rule, onToggle, onEdit, onDelete, onDuplicate, onOpen, subtitle, aiEnabled, badges = [], thumb }) {
  const showAiBadge = aiEnabled ?? rule.aiConfig?.aiEnabled ?? rule.aiEnabled ?? false
  const trend = rule.stats.trend7d
  const menuItems = [
    { label: 'Edit', icon: Pencil, onClick: () => onEdit(rule) },
    ...(onDuplicate ? [{ label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(rule) }] : []),
    { label: 'Delete', icon: Trash2, onClick: () => onDelete(rule.id), danger: true },
  ]
  return (
    <div role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onClick={() => onOpen?.(rule)}
      onKeyDown={onOpen ? (e => { if (e.key === 'Enter') onOpen(rule) }) : undefined}
      className={clsx('h-full flex flex-col bg-white border rounded-2xl p-3.5 transition-all hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.12)]',
        onOpen && 'cursor-pointer',
        rule.active ? 'border-surface-border hover:border-primary/25' : 'border-surface-border/60 bg-slate-50/40')}>
      <div className="flex items-start gap-3.5 flex-1">
        {thumb}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <p className={clsx('text-[13px] font-semibold truncate', rule.active ? 'text-slate-800' : 'text-slate-500')}>{rule.name}</p>
              {showAiBadge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 flex items-center gap-0.5 flex-shrink-0">
                  <Sparkles size={9}/> AI
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <Toggle checked={rule.active} onChange={v => onToggle(rule.id, v)}/>
              <KebabMenu items={menuItems}/>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug truncate">{subtitle}</p>
          {badges.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {badges.map(b => (
                <span key={b.label} className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5', b.className || 'bg-blue-50 text-blue-600 border-blue-200')}>
                  {b.icon && <b.icon size={9}/>} {b.label}
                </span>
              ))}
            </div>
          )}
          <div className="flex-1"/>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            <span className="font-bold text-slate-600">{rule.stats.triggered.toLocaleString()}</span> triggered
            {trend != null && trend !== 0 && (
              <span className={clsx('flex items-center gap-0.5 font-bold', trend > 0 ? 'text-emerald-500' : 'text-red-400')}>
                <TrendingUp size={9} className={trend < 0 ? 'rotate-180' : ''}/>{Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── content thumbnail — shows which post/reel/story a rule targets ──── */
export function ContentThumb({ item, scope, kind = 'post' }) {
  if (scope === 'all') {
    return (
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}>
        <LayoutGrid size={18} className="text-indigo-300"/>
      </div>
    )
  }
  return (
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl relative overflow-hidden shadow-inner"
      style={{ background: kind === 'story' ? 'linear-gradient(135deg,#fbcfe8,#f0abfc)' : 'linear-gradient(135deg,#fde68a,#fca5a5)' }}>
      <span className="drop-shadow-sm">{item?.emoji || '—'}</span>
    </div>
  )
}

/* ─── empty state — used when a rule list has nothing to show ─────────── */
export function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40">
      <div className="w-11 h-11 rounded-full bg-white border border-surface-border flex items-center justify-center mb-3">
        <Icon size={18} className="text-slate-300"/>
      </div>
      <p className="text-[12px] font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1 max-w-xs">{sub}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ─── segmented sub-tab bar (pill style, matches Analytics/Contact tabs) ── */
export function SegmentedTabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
      {tabs.map(t => {
        const Icon = t.icon
        const isActive = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
              isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {Icon && <Icon size={13} className={isActive ? '' : 'text-slate-400'} style={isActive && t.color ? { color: t.color } : undefined}/>}
            {t.label}
            {t.count != null && (
              <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full', isActive ? 'bg-slate-100 text-slate-500' : 'bg-slate-200/70 text-slate-500')}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─── bulk actions — tucked into a small menu instead of an always-visible bar ── */
export function BulkActionsMenu({ total, activeCount, onPauseAll, onEnableAll }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  if (total === 0) return null
  const allActive = activeCount === total
  const allPaused = activeCount === 0
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button onClick={() => setOpen(p => !p)} className="btn-secondary !text-[11px]">
        {activeCount}/{total} active <ChevronDown size={11}/>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-surface-border rounded-xl shadow-modal z-30 py-1 overflow-hidden" onClick={() => setOpen(false)}>
          <button onClick={onEnableAll} disabled={allActive} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none">
            <PlayCircle size={12}/> Enable all
          </button>
          <button onClick={onPauseAll} disabled={allPaused} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none">
            <PauseCircle size={12}/> Pause all
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── stats strip — one light inline line instead of a grid of cards ─── */
export function RuleStatsBar({ stats }) {
  return (
    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-slate-500 px-0.5">
      {stats.map((s, i) => (
        <span key={s.label} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-200 -ml-2.5 mr-1.5">·</span>}
          <span className="font-bold text-slate-700">{s.value}</span> {s.label.toLowerCase()}
        </span>
      ))}
    </div>
  )
}

/* ─── rule list toolbar — search + sort + templates + new rule ──────── */
export function RuleToolbar({ search, onSearch, sort, onSort, onTemplates, onNew, newLabel = 'New Rule', bulk }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300"/>
        <input type="text" value={search} onChange={e => onSearch(e.target.value)} placeholder="Search…"
          className="input-sm w-full !pl-7"/>
      </div>
      <select value={sort} onChange={e => onSort(e.target.value)}
        className="text-[11px] text-slate-500 font-medium border border-surface-border rounded-lg px-2 py-1.5 bg-white focus:outline-none cursor-pointer">
        <option value="priority">Newest first</option>
        <option value="triggered">Most triggered</option>
        <option value="az">Name A–Z</option>
      </select>
      {bulk}
      <div className="flex-1"/>
      {onTemplates && (
        <button onClick={onTemplates} className="btn-secondary flex-shrink-0"><LayoutTemplate size={12}/> Templates</button>
      )}
      <button onClick={onNew} className="btn-primary flex-shrink-0"><Plus size={13}/> {newLabel}</button>
    </div>
  )
}

/* ─── collapsed "Advanced" section — Follow-Gate, Frequency Cap, etc. tucked away by default ── */
export function AdvancedSection({ children, summary }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-surface-border overflow-hidden">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-hover transition-colors">
        <span className="text-[12px] font-semibold text-slate-600 flex items-center gap-1.5">
          <SlidersHorizontal size={12} className="text-slate-400"/> Advanced
          {summary && <span className="text-[10px] font-normal text-slate-400">— {summary}</span>}
        </span>
        <ChevronDown size={13} className={clsx('text-slate-400 transition-transform', open && 'rotate-180')}/>
      </button>
      {open && <div className="p-3 pt-0 space-y-2.5">{children}</div>}
    </div>
  )
}

/* ─── template gallery modal — one-click starter rules ───────────────── */
export function TemplateGallery({ title, templates, onUse, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-surface-border rounded-2xl w-full max-w-lg shadow-modal flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-surface-border flex-shrink-0">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5"><LayoutTemplate size={14}/> {title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-surface-hover"><X size={15}/></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto">
          {templates.map(t => (
            <button key={t.name} onClick={() => onUse(t)}
              className="text-left p-3.5 rounded-xl border border-surface-border hover:border-primary/40 hover:bg-primary-50/30 transition-colors group">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{t.emoji}</span>
                <p className="text-[12px] font-semibold text-slate-800 group-hover:text-primary">{t.name}</p>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Follow-Gate — ManyChat/ReplyKaro's trust-building gate before DMing non-followers ── */
export function FollowGateField({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v })
  return (
    <div className="p-3 rounded-xl border border-surface-border">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5"><UserCheck size={12} className="text-teal-500"/> Follow-Gate</p>
        <Toggle checked={config.enabled} onChange={v => set('enabled', v)}/>
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">Only follow this rule's action for people who already follow you — everyone else gets a gentle "follow to unlock" nudge first.</p>
      {config.enabled && (
        <textarea rows={2} className="textarea !text-[11px] mt-2" placeholder="e.g. Follow us and comment again to get the link! 🔗"
          value={config.nudgeMessage || ''} onChange={e => set('nudgeMessage', e.target.value)}/>
      )}
    </div>
  )
}

/* ─── frequency cap — don't re-trigger the same rule on the same user too often ── */
export function FrequencyCapField({ value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="label">Frequency cap</label>
      <NativeSelect sm value={value} onChange={e => onChange(e.target.value)}>
        <option value="none">No limit — every time</option>
        <option value="1h">Once per user / hour</option>
        <option value="24h">Once per user / day</option>
        <option value="7d">Once per user / week</option>
      </NativeSelect>
      <p className="text-[9px] text-slate-400">Prevents spamming the same person if they keep matching this rule.</p>
    </div>
  )
}

/* ─── live phone-frame preview of how a rule plays out ────────────────── */
export function PhonePreview({ messages }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-slate-400">
        <Smartphone size={11}/> Live Preview
      </div>
      <div className="w-full max-w-[220px] bg-slate-900 rounded-[22px] p-1.5 shadow-lg">
        <div className="bg-white rounded-[16px] overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 via-pink-500 to-purple-600 flex-shrink-0"/>
            <span className="text-[10px] font-semibold text-slate-700">Instagram</span>
          </div>
          <div className="p-2.5 space-y-2 min-h-[160px] bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={clsx('flex', m.from === 'bot' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[85%] px-2.5 py-1.5 rounded-2xl text-[10px] leading-snug',
                  m.from === 'bot' ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-600 rounded-bl-sm')}>
                  {m.text}
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-[10px] text-slate-300 text-center pt-8">Fill in the rule to see a preview…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── realistic Instagram-style live preview — dark chat UI + Post/Comments/DM tabs ── */
export function InstagramLivePreview({ account = 'acmecorp.official', post, triggerComment, publicReplies, dmMessages, showTabs = false }) {
  const [tab, setTab] = useState(showTabs ? 'post' : 'dm')
  const TABS = [
    { id: 'post', label: 'Post' },
    { id: 'comments', label: 'Comments' },
    { id: 'dm', label: 'DM' },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-slate-400">
        <Smartphone size={11}/> Live Preview
      </div>
      <div className="w-full max-w-[260px] bg-black rounded-[26px] p-2 shadow-xl">
        <div className="bg-black rounded-[18px] overflow-hidden border border-slate-800">
          {/* header */}
          <div className="px-3 py-2.5 flex items-center gap-2 border-b border-slate-800">
            <ChevronDown size={14} className="text-white rotate-90"/>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 via-pink-500 to-purple-600 flex-shrink-0"/>
            <span className="text-[11px] font-semibold text-white truncate flex-1">{account}</span>
            <Send size={12} className="text-white rotate-45"/>
          </div>

          {/* body */}
          <div className="min-h-[220px] bg-black">
            {tab === 'post' && post && (
              <div>
                <div className="aspect-square w-full flex items-center justify-center text-6xl" style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}>
                  {post.emoji}
                </div>
                <div className="px-2.5 py-2 flex items-center gap-3 text-white">
                  <Heart size={15}/><MessageCircle size={15}/><Send size={15} className="rotate-45"/>
                </div>
                <p className="px-2.5 text-[10px] font-semibold text-white">{post.likes} likes</p>
                <p className="px-2.5 pb-2 text-[10px] text-slate-300 leading-snug"><span className="font-semibold text-white">{account}</span> {post.caption}</p>
              </div>
            )}

            {tab === 'comments' && (
              <div className="p-2.5 space-y-2.5">
                {post && (
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: '#1e293b' }}>{post.emoji}</div>
                    <p className="text-[9px] text-slate-400 truncate">{post.caption}</p>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex-shrink-0"/>
                  <div className="min-w-0">
                    <p className="text-[10px] text-white"><span className="font-semibold">follower_123</span> {triggerComment || 'comment…'}</p>
                    <p className="text-[8px] text-slate-500 mt-0.5">2m</p>
                  </div>
                </div>
                {publicReplies?.length > 0 && (
                  <div className="flex items-start gap-2 pl-5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 via-pink-500 to-purple-600 flex-shrink-0"/>
                    <div className="min-w-0">
                      <p className="text-[10px] text-white"><span className="font-semibold">{account}</span> {publicReplies[0]}</p>
                      <p className="text-[8px] text-slate-500 mt-0.5">Just now</p>
                    </div>
                  </div>
                )}
                {!publicReplies?.length && <p className="text-[9px] text-slate-500 italic pl-5">No public reply configured</p>}
              </div>
            )}

            {tab === 'dm' && (
              <div className="p-2.5 space-y-2">
                {(!dmMessages || dmMessages.length === 0) && (
                  <p className="text-[10px] text-slate-500 text-center pt-8">Fill in the automation to see a preview…</p>
                )}
                {dmMessages?.map((m, i) => (
                  <div key={i} className={clsx('flex', m.from === 'bot' ? 'justify-start' : 'justify-end')}>
                    {m.button ? (
                      <span className={clsx('px-3 py-1.5 rounded-full text-[10px] font-semibold border',
                        m.from === 'bot' ? 'border-slate-600 text-slate-200' : 'bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white border-transparent')}>
                        {m.button}
                      </span>
                    ) : (
                      <div className={clsx('max-w-[80%] px-3 py-1.5 rounded-2xl text-[10px] leading-snug',
                        m.from === 'bot' ? 'bg-slate-800 text-slate-100 rounded-bl-sm' : 'bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white rounded-br-sm')}>
                        {m.text}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          {showTabs ? (
            <div className="flex items-center border-t border-slate-800">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={clsx('flex-1 py-2 text-[9px] font-bold uppercase tracking-wide transition-colors', tab === t.id ? 'text-white border-t-2 border-white -mt-px' : 'text-slate-500')}>
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2.5 py-2 border-t border-slate-800 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border border-slate-600 flex-shrink-0"/>
              <span className="flex-1 text-[9px] text-slate-500">Message...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
/* ─── keyword chip input ─────────────────────────────────────── */
export function KeywordInput({ keywords, onChange }) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (v && !keywords.includes(v)) onChange([...keywords, v])
    setDraft('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {keywords.map(k => (
          <span key={k} className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-[11px] text-slate-600">
            {k}
            <button onClick={() => onChange(keywords.filter(x => x !== k))} className="text-slate-400 hover:text-red-500"><X size={10}/></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input type="text" className="input-sm flex-1" placeholder="Add a keyword and press Enter"
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}/>
        <button onClick={add} className="px-3 rounded-lg bg-primary-50 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors">Add</button>
      </div>
    </div>
  )
}

/* ─── Content picker — "All Posts" vs specific posts/reels/stories ──────── */
/* ─── post/reel grid tile — tap-to-select, mirrors ManyChat's "choose a post" picker ── */
function ContentTile({ item, kind, selected, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className={clsx('relative aspect-square rounded-xl overflow-hidden flex items-center justify-center text-3xl border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-transparent hover:border-primary/30')}
      style={{ background: kind === 'story' ? 'linear-gradient(135deg,#fbcfe8,#f0abfc)' : 'linear-gradient(135deg,#fde68a,#fca5a5)' }}>
      <span className="drop-shadow-sm">{item.emoji}</span>
      {kind !== 'story' && item.type === 'reel' && (
        <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/45 text-white text-[8px] font-bold">
          <Film size={8}/> REEL
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent text-white text-[8.5px] font-medium truncate text-left">
        {item.caption}
      </span>
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-primary text-white flex items-center justify-center shadow">
          <Check size={11} strokeWidth={3}/>
        </span>
      )}
      <span className={clsx('absolute inset-0 transition-colors', selected ? 'bg-primary/10' : 'bg-transparent')}/>
    </button>
  )
}

export function ContentPicker({ items, scope, selectedIds, onScopeChange, onSelectionChange, kind = 'post' }) {
  const noun = kind === 'story' ? 'Stories' : 'Posts & Reels'

  function toggleItem(id) {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => onScopeChange('all')}
          className={clsx('flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors',
            scope === 'all' ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover')}>
          <LayoutGrid size={12}/> All {noun} {kind !== 'story' && '(+ future)'}
        </button>
        <button onClick={() => onScopeChange('specific')}
          className={clsx('flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-colors',
            scope === 'specific' ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border text-slate-600 hover:bg-surface-hover')}>
          <Grid3x3 size={12}/> Specific {noun}
        </button>
      </div>

      {scope === 'all' ? (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-surface-border">
          <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-px"/>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {kind === 'story'
              ? 'Applies to every story you post, automatically — no need to add new ones manually.'
              : 'Applies to every post & reel — including ones you publish after saving this rule.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10.5px] text-slate-400">Tap to select the {kind === 'story' ? 'stories' : 'posts or reels'} this should apply to.</p>
          <div className="grid grid-cols-3 gap-2">
            {items.map(it => (
              <ContentTile key={it.id} item={it} kind={kind} selected={selectedIds.includes(it.id)} onToggle={() => toggleItem(it.id)}/>
            ))}
          </div>
        </div>
      )}
      {scope === 'specific' && selectedIds.filter(Boolean).length === 0 && (
        <p className="text-[10px] text-amber-600">Select at least one {kind === 'story' ? 'story' : 'post or reel'} above.</p>
      )}
    </div>
  )
}

/* ─── AI reply config — shared by every automation surface (DM/Comment/Story) ── */
export function AIReplyConfig({ config, onChange, messagePlaceholder = 'Type the reply…', aiLabel = 'Use AI to generate this reply', hideToggle = false }) {
  const fileInputRef = useRef(null)
  function set(k, v) { onChange({ ...config, [k]: v }) }
  function addDocs(fileList) {
    const incoming = Array.from(fileList || []).map(f => ({ id: `${Date.now()}-${f.name}`, name: f.name }))
    if (incoming.length) set('docs', [...(config.docs || []), ...incoming])
  }
  function removeDoc(id) { set('docs', (config.docs || []).filter(d => d.id !== id)) }

  return (
    <div className="space-y-2.5">
      {!hideToggle && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-surface-border">
          <p className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
            <Sparkles size={12} className="text-purple-500"/> {aiLabel}
          </p>
          <Toggle checked={config.aiEnabled} onChange={v => set('aiEnabled', v)}/>
        </div>
      )}

      {(hideToggle || config.aiEnabled) ? (
        <div className="pl-3 border-l-2 border-purple-100 space-y-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500">Instructions for this rule <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea rows={2} className="textarea !text-[11px]" placeholder="e.g. Mention we ship in 2 days. Keep it under 2 sentences."
              value={config.instructions || ''} onChange={e => set('instructions', e.target.value)}/>
            <p className="text-[9px] text-slate-400">Adds to your global AI instructions (AI Settings) — doesn't replace them.</p>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={config.useGlobalKb !== false} onChange={e => set('useGlobalKb', e.target.checked)}/>
              <span className="text-[11px] text-slate-600">Use workspace Knowledge Base</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(config.docs || []).map(d => (
                <span key={d.id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-[10px] text-slate-600">
                  <FileText size={9}/> {d.name}
                  <button type="button" onClick={() => removeDoc(d.id)} className="hover:text-red-500"><X size={9}/></button>
                </span>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-slate-300 text-[10px] text-slate-500 hover:border-primary/40 hover:text-primary transition-colors">
                <Upload size={9}/> Attach file for this rule
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv" className="hidden" onChange={e => { addDocs(e.target.files); e.target.value = '' }}/>
            </div>
          </div>
        </div>
      ) : (
        <textarea rows={2} className="textarea" placeholder={messagePlaceholder}
          value={config.message || ''} onChange={e => set('message', e.target.value)}/>
      )}
    </div>
  )
}

/* ─── performance analytics — shared by the Automations page's own Performance tab ──
   and the main Instagram Analytics page, so both surfaces show identical numbers. ── */
export function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  // avalanche finalizer (murmur3-style) — a plain polynomial hash leaves near-identical
  // inputs (e.g. "id-0" vs "id-1") only 1 apart, which visibly clusters downstream %-bucketing.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return Math.abs(h)
}

function dailySpark(id, total) {
  return Array.from({ length: 7 }, (_, d) => {
    const hd = hashStr(`${id}-day-${d}`)
    return Math.max(1, Math.round((total / 7) * (0.5 + (hd % 100) / 100)))
  })
}

export function buildAutomationPerf(rules) {
  return rules.map(r => {
    const h = hashStr(r.id)
    const triggered = r.stats.triggered
    const uniqueUsers = Math.round(triggered * (0.72 + (h % 20) / 100))
    const avgCompletionTime = `${1 + (h % 12)}m ${h % 60}s`
    const spark = dailySpark(r.id, triggered)
    const common = { uniqueUsers, avgCompletionTime, spark, repeatRate: triggered ? Math.round((1 - uniqueUsers / triggered) * 100) : 0 }

    if (r.source === 'comment') {
      const dmOpened = Math.round(triggered * (0.85 + (h % 10) / 100))
      const linkClicked = Math.round(dmOpened * (0.45 + (h % 30) / 100))
      return {
        ...r, ...common,
        funnel: [
          { label: 'Comment matched', value: triggered },
          { label: 'Opening DM sent', value: dmOpened },
          { label: 'Link DM clicked', value: linkClicked },
        ],
        completionLabel: 'Link click rate',
        completionRate: triggered ? Math.round((linkClicked / triggered) * 100) : 0,
      }
    }
    const replied = Math.round(triggered * (0.9 + (h % 8) / 100))
    const engaged = Math.round(replied * (0.2 + (h % 25) / 100))
    return {
      ...r, ...common,
      funnel: [
        { label: 'Triggered',         value: triggered },
        { label: 'Reply sent',        value: replied },
        { label: 'User replied back', value: engaged },
      ],
      completionLabel: 'Reply-back rate',
      completionRate: triggered ? Math.round((engaged / triggered) * 100) : 0,
    }
  })
}

export function buildPostPerf(rules) {
  return MOCK_POSTS.map(p => {
    const h = hashStr(p.id)
    const attachedRules = rules.filter(r => r.source === 'comment' && (r.targetScope === 'all' || r.targetIds.includes(p.id)))
    const triggered = 20 + (h % 400)
    const dmsSent = Math.round(triggered * (0.8 + (h % 15) / 100))
    const linkClicks = Math.round(dmsSent * (0.4 + (h % 30) / 100))
    return { ...p, attachedCount: attachedRules.length, triggered, dmsSent, linkClicks, ctr: dmsSent ? Math.round((linkClicks / dmsSent) * 100) : 0 }
  }).sort((a, b) => b.triggered - a.triggered)
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="p-2 rounded-lg bg-slate-50 border border-surface-border min-w-0">
      <div className="flex items-center gap-1 text-slate-400">
        <Icon size={10} className="flex-shrink-0"/>
        <span className="text-[8.5px] font-semibold uppercase tracking-wide truncate">{label}</span>
      </div>
      <p className="text-[12.5px] font-bold text-slate-800 mt-0.5 truncate">{value}</p>
    </div>
  )
}

function Sparkline({ data }) {
  const max = Math.max(...data, 1)
  const w = 240, h = 36, pad = 3
  const point = (v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * (w - pad * 2) + pad : w / 2
    const y = h - pad - (v / max) * (h - pad * 2)
    return [x, y]
  }
  const pts = data.map((v, i) => point(v, i).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v, i) => {
        const [x, y] = point(v, i)
        return <circle key={i} cx={x} cy={y} r="2" fill="rgb(var(--accent))"/>
      })}
    </svg>
  )
}

export function AutomationPerfCard({ r, sourceMeta, detailed = false }) {
  const src = sourceMeta[r.source]
  const maxVal = r.funnel[0].value || 1
  return (
    <div className="bg-white border border-surface-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', r.active ? 'bg-emerald-400' : 'bg-slate-300')}/>
            <p className="text-[12px] font-semibold text-slate-800 truncate">{r.name}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            {src && <src.icon size={10}/>} {src?.label} automation
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-slate-900">{r.stats.triggered.toLocaleString()}</p>
          <p className={clsx('text-[9.5px] font-semibold flex items-center justify-end gap-0.5', r.stats.trend7d >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {r.stats.trend7d >= 0 ? '+' : ''}{r.stats.trend7d}%
          </p>
        </div>
      </div>

      {detailed && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat icon={Users} label="Unique users" value={r.uniqueUsers.toLocaleString()}/>
          <MiniStat icon={Clock} label="Avg. to complete" value={r.avgCompletionTime}/>
          <MiniStat icon={Repeat2} label="Repeat triggers" value={`${r.repeatRate}%`}/>
        </div>
      )}

      <div className="space-y-1.5">
        {r.funnel.map((step, i) => {
          const prevVal = i > 0 ? r.funnel[i - 1].value : null
          const dropPct = prevVal ? Math.round(((prevVal - step.value) / prevVal) * 100) : null
          return (
            <div key={step.label}>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-slate-500">{step.label}</span>
                <span className="flex items-center gap-1.5">
                  {detailed && dropPct != null && dropPct > 0 && (
                    <span className="text-red-400 font-semibold flex items-center gap-0.5"><TrendingDown size={9}/>-{dropPct}%</span>
                  )}
                  <span className="font-semibold text-slate-700">{step.value.toLocaleString()}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${maxVal ? (step.value / maxVal) * 100 : 0}%`,
                  background: i === r.funnel.length - 1 ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.5)',
                }}/>
              </div>
            </div>
          )
        })}
      </div>

      {detailed && (
        <div>
          <p className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Triggers — last 7 days</p>
          <Sparkline data={r.spark}/>
        </div>
      )}

      <div className="pt-1 border-t border-surface-border flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{r.completionLabel}</span>
        <span className="text-[11px] font-bold" style={{ color: 'rgb(var(--accent))' }}>{r.completionRate}%</span>
      </div>
    </div>
  )
}

/* ─── post-wise performance table — same shape used by both Performance surfaces ── */
export function PostPerfTable({ postPerf }) {
  return (
    <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
        <LayoutGrid size={13} className="text-slate-400"/>
        <div>
          <p className="text-xs font-semibold text-slate-800">Post-wise Performance</p>
          <p className="text-[10px] text-slate-400">How each post/reel is driving comment automations</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-slate-400 border-b border-surface-border">
              <th className="px-4 py-2 font-medium">Post</th>
              <th className="px-3 py-2 font-medium">Automations</th>
              <th className="px-3 py-2 font-medium">Triggered</th>
              <th className="px-3 py-2 font-medium">DMs Sent</th>
              <th className="px-3 py-2 font-medium">Link Clicks</th>
              <th className="px-3 py-2 font-medium">CTR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {postPerf.map(p => (
              <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#fde68a,#fca5a5)' }}>{p.emoji}</div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate max-w-[180px]">{p.caption}</p>
                      <p className="text-[9.5px] text-slate-400">{p.type === 'reel' ? 'Reel' : 'Post'} · {p.likes} likes</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{p.attachedCount || '—'}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-800">{p.triggered.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-slate-600">{p.dmsSent.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-slate-600">{p.linkClicks.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <span className={clsx('font-semibold', p.ctr >= 60 ? 'text-emerald-600' : p.ctr >= 40 ? 'text-amber-600' : 'text-red-500')}>{p.ctr}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── subscribers — who triggered a specific automation, and what they said ── */
const SUBSCRIBER_NAMES = [
  'meera.k', 'arjun.dev', 'priya.styles', 'rahul_m', 'ananya.rao', 'karthik.iyer',
  'sana.iyer', 'vikram.singh', 'neha_patel', 'rohan.shah', 'divya.reddy', 'aditya.k',
  'ishita.verma', 'aryan.mehta', 'pooja.nair', 'siddharth.rao', 'kavya.menon', 'yash.gupta',
]

const COMMENT_STAGES = ['Commented', 'Opening DM sent', 'Link clicked', 'Followed & clicked']
const DM_STAGES = ['Triggered', 'Replied', 'Engaged further']

export function buildSubscribers(rule, count = 14) {
  const seed = hashStr(rule.id)
  const kw = rule.keywords?.[0]
  return Array.from({ length: count }, (_, i) => {
    const h = hashStr(`${rule.id}-${i}`)
    const username = SUBSCRIBER_NAMES[(seed + i) % SUBSCRIBER_NAMES.length]
    const minsAgo = 4 + (h % 2800)
    const at = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`
    const roll = h % 100
    let text, stage
    if (rule.source === 'comment') {
      text = kw ? `"${kw}${roll % 3 === 0 ? ' please 🙏' : roll % 3 === 1 ? '?!' : ''}"` : '"Love this! 😍"'
      stage = roll < 15 ? COMMENT_STAGES[0] : roll < 45 ? COMMENT_STAGES[1] : roll < 80 ? COMMENT_STAGES[2] : COMMENT_STAGES[3]
    } else if (rule.source === 'dm') {
      text = kw ? `"${kw}"` : '"Hey! Quick question 👋"'
      stage = roll < 20 ? DM_STAGES[0] : roll < 70 ? DM_STAGES[1] : DM_STAGES[2]
    } else {
      text = '"Replied to your story ✨"'
      stage = roll < 25 ? DM_STAGES[0] : roll < 75 ? DM_STAGES[1] : DM_STAGES[2]
    }
    return { id: `${rule.id}-sub-${i}`, username, text, at, stage, hue: h % 360 }
  })
}

const STAGE_STYLE = {
  'Commented':          'bg-slate-50 text-slate-500 border-slate-200',
  'Opening DM sent':    'bg-blue-50 text-blue-600 border-blue-200',
  'Link clicked':       'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Followed & clicked': 'bg-purple-50 text-purple-600 border-purple-200',
  'Triggered':          'bg-slate-50 text-slate-500 border-slate-200',
  'Replied':            'bg-blue-50 text-blue-600 border-blue-200',
  'Engaged further':    'bg-emerald-50 text-emerald-600 border-emerald-200',
}

export function SubscribersTable({ subscribers, totalTriggered }) {
  const [search, setSearch] = useState('')
  const filtered = subscribers.filter(s => s.username.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300"/>
          <input className="input-sm pl-7 w-full" placeholder="Search username…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        {totalTriggered != null && (
          <p className="text-[10px] text-slate-400 flex-shrink-0">Showing {filtered.length} recent of {totalTriggered.toLocaleString()} total</p>
        )}
      </div>
      <div className="border border-surface-border rounded-xl overflow-hidden divide-y divide-surface-border max-h-[360px] overflow-y-auto">
        {filtered.map(s => (
          <div key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-hover transition-colors">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: `hsl(${s.hue} 65% 55%)` }}>
              {s.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[11.5px] font-semibold text-slate-700 truncate">@{s.username}</p>
                <span className="text-[9px] text-slate-300 flex-shrink-0">·</span>
                <span className="text-[9.5px] text-slate-400 flex-shrink-0">{s.at}</span>
              </div>
              <p className="text-[10.5px] text-slate-500 truncate">{s.text}</p>
            </div>
            <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0', STAGE_STYLE[s.stage] || 'bg-slate-50 text-slate-500 border-slate-200')}>
              {s.stage}
            </span>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-[11px] text-slate-400 text-center py-8">No subscribers match "{search}"</p>}
      </div>
    </div>
  )
}

/* ─── Flow step types — Instagram DM automation only supports these ─────── */
export const STEP_TYPES = [
  { id: 'dm',        label: 'Send DM',            icon: Send          },
  { id: 'ai',        label: 'AI Response',        icon: Sparkles      },
  { id: 'reply',     label: 'Public Reply',       icon: MessageCircle },
  { id: 'wait',      label: 'Smart Delay',        icon: Clock         },
  { id: 'tag',       label: 'Add Tag',            icon: Hash          },
  { id: 'untag',     label: 'Remove Tag',         icon: Hash          },
  { id: 'setfield',  label: 'Set Custom Field',   icon: Variable      },
  { id: 'form',      label: 'Collect Info',       icon: Pencil        },
  { id: 'condition', label: 'Condition',          icon: GitBranch,    branch: true, branchLabels: ['Yes', 'No'] },
  { id: 'split',     label: 'Random Split',       icon: Shuffle,      branch: true, branchLabels: ['Path A (50%)', 'Path B (50%)'] },
  { id: 'notify',    label: 'Notify Agent',       icon: AlertCircle   },
  { id: 'webhook',   label: 'External Request',   icon: Link2         },
  { id: 'crm',       label: 'Push to CRM',        icon: ExternalLink  },
]
export const STEP_META = Object.fromEntries(STEP_TYPES.map(s => [s.id, s]))
/** Step types selectable *inside* a branch — branching steps are excluded to keep nesting to one level. */
export const BRANCH_STEP_TYPES = STEP_TYPES.filter(s => !s.branch)

/**
 * Question types available for a flow's "Collect Info" step — full parity
 * with WhatsApp's "Ask" node catalog, and mapped to the standard chatbot-builder
 * Question/Input + Hybrid taxonomy (name, email, mobile_number, location, website,
 * contacts, single_choice, multi_choice, date_time, numerical_value, range, rating,
 * dynamic_question, faqs…). Instagram DMs have no native date picker, location-share
 * button, list-message UI, or payment sheet the way WhatsApp's Business API does, so
 * those are backed by free-text / quick-reply equivalents instead (noted per-type
 * below) rather than left out entirely.
 */
export const INSTAGRAM_QUESTION_TYPES = [
  { id: 'name',     name: 'Full Name',      desc: 'Free text — parsed into first/last/full name',  icon: User,         color: '#3B82F6' },
  { id: 'short',    name: 'Short Text',     desc: 'Single-line free text answer',                 icon: Pencil,       color: '#3B82F6' },
  { id: 'long',     name: 'Long Text',      desc: 'Multi-line paragraph response',                icon: FileText,     color: '#3B82F6' },
  { id: 'number',   name: 'Number',         desc: 'Numeric input, regex-validated (age, qty…)',   icon: Hash,         color: '#3B82F6' },
  { id: 'email',    name: 'Email',          desc: 'Email address, format-checked',                icon: Send,         color: '#3B82F6' },
  { id: 'phone',    name: 'Mobile Number',  desc: 'Phone number — E.164 formatting/validation',    icon: Send,         color: '#3B82F6' },
  { id: 'url',      name: 'Website / URL',  desc: 'Link, format-checked',                         icon: Globe,        color: '#3B82F6' },
  { id: 'contacts', name: 'Contact Card',   desc: 'Collected as text — no native IG contact card', icon: Contact,      color: '#3B82F6' },
  { id: 'date',     name: 'Date & Time',    desc: 'Collected as text — no native IG date picker',  icon: Calendar,     color: '#F97316' },
  { id: 'location', name: 'Location',       desc: 'Asks for an address as text — no location pin', icon: MapPin,       color: '#F97316' },
  { id: 'appointment_booking', name: 'Appointment Booking', desc: 'Chained quick replies: service → date → time slot', icon: Calendar, color: '#F97316' },
  { id: 'single',   name: 'Single Choice',  desc: 'Pick one via quick-reply buttons (max 13)',     icon: CheckCircle2, color: '#8B5CF6' },
  { id: 'multi',    name: 'Multi-Select',   desc: 'Pick several, one quick-reply tap at a time',   icon: ListChecks,   color: '#8B5CF6' },
  { id: 'yesno',    name: 'Yes / No',       desc: 'Binary quick-reply buttons',                    icon: CheckCircle2, color: '#8B5CF6' },
  { id: 'range',    name: 'Range',          desc: 'Min–max numeric or currency range',             icon: SlidersHorizontal, color: '#8B5CF6' },
  { id: 'rating',   name: 'Rating',         desc: '1–5 / 1–10 scale via quick replies (CSAT/NPS)', icon: Star,         color: '#8B5CF6' },
  { id: 'image',    name: 'Image Upload',   desc: 'User sends a photo in the DM',                  icon: Upload,       color: '#F59E0B' },
  { id: 'product',  name: 'Product Picker', desc: 'Pick from your catalog — sent as quick replies', icon: Package,      color: '#10B981' },
  { id: 'payment',  name: 'Payment Link',   desc: 'Sends a checkout link — no native pay sheet',    icon: CreditCard,   color: '#10B981' },
  { id: 'dynamic_question', name: 'AI Dynamic Question', desc: 'Claude generates the next question from context', icon: Sparkles, color: '#EC4899' },
  { id: 'faqs',     name: 'FAQ / Knowledge Base', desc: 'Free text matched against your Knowledge Base (RAG)', icon: HelpCircle, color: '#EC4899' },
]
export const INSTAGRAM_QUESTION_TYPE_META = Object.fromEntries(INSTAGRAM_QUESTION_TYPES.map(q => [q.id, q]))
