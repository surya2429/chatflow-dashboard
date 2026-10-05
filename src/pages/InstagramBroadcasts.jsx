// InstagramBroadcasts.jsx — Instagram's counterpart to the WhatsApp Broadcasts
// page: the same Campaigns / Templates / Template Logs layout, campaign wizard,
// Quick Send and campaign insights, built to what Meta's Messaging API allows.
//
// What differs from WhatsApp, and why (Meta docs, checked October 2026):
//   - A business may message a user only within 24 hours of that user's last
//     message. There are no approved templates that reopen a closed window,
//     so templates here are not submitted for review (Ready / Draft only).
//   - HUMAN_AGENT (7 days) is for a person handling support, never for
//     automated or promotional sends. One-Time Notifications and Sponsored
//     Messages are Messenger-only; Recurring Notifications / Marketing
//     Messages ended on 10 Feb 2026.
//   - A private reply to a comment is the one supported way to start a DM with
//     someone who has not messaged first: ONE text message per comment, within
//     7 days.
// So a campaign delivers to contacts whose window is open at the SEND time;
// everyone else is skipped and counted, never queued.
import { useState, useMemo, useEffect, useRef } from 'react'
import igPortal from '../components/instagram/igPortal'
import clsx from 'clsx'
import {
  Plus, Search, ChevronLeft, ChevronRight, X, Send, FileText, History, BarChart2, Inbox, Eye, Shield,
  CornerUpLeft, CheckCircle2, AlertCircle, Zap, Copy, Check, Download, MailOpen,
  MousePointerClick, Users, MessageCircle, Reply, ShieldCheck, Link2,
} from 'lucide-react'
import { NativeSelect } from '../components/Select'
import { INIT_CONTACTS, INIT_GROUPS } from './InstagramContacts'
import IgDmPreview from '../components/instagram/IgDmPreview'
import IgTemplateBuilder from '../components/instagram/IgTemplateBuilder'
import IgTemplatesView, { IgStatusPill } from '../components/instagram/IgTemplatesView'
import IgCampaignWizard, { CHIP } from '../components/instagram/IgCampaignWizard'
import {
  HOUR, POSTS, commentState, windowState, summarize, personalizeTemplate,
  loadTemplates, saveTemplates,
} from '../components/instagram/igTemplateKit'

const DAY = 86400000
const STATUS_TABS = ['All', 'Sending', 'Scheduled', 'Completed', 'Failed']
const PAGE_SIZE = 10

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)
const fmt = ms => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
const KIND_TONE = { generic: 'bg-pink-50 text-pink-500', button: 'bg-violet-50 text-violet-500', text: 'bg-sky-50 text-sky-500' }

/* ── seed data ─────────────────────────────────────────────────────────── */
function seedCampaigns(templates) {
  const tpl = id => templates.find(t => t.id === id) || templates[0]
  const now = Date.now()
  return [
    { id: 'c1', name: 'Summer drop — new arrivals', type: 'dm', template: tpl('tpl_seed_1'), audienceLabel: 'All contacts',
      sendAt: now - 3 * DAY, targeted: 214, planned: 96, skippedExpired: 108, skippedOptout: 10,
      sent: 96, delivered: 93, seen: 71, replied: 24, failed: 3, clicks: 38, status: 'Completed' },
    { id: 'c2', name: 'Support menu nudge', type: 'dm', template: tpl('tpl_seed_2'), audienceLabel: 'Tag · customer',
      sendAt: now - 6 * DAY, targeted: 140, planned: 62, skippedExpired: 70, skippedOptout: 8,
      sent: 62, delivered: 60, seen: 44, replied: 19, failed: 2, clicks: 27, status: 'Completed' },
    { id: 'c3', name: 'Reel comment follow-up', type: 'comments', template: tpl('tpl_seed_4'), audienceLabel: 'Summer collection reel',
      sendAt: now - 4 * DAY, targeted: 9, planned: 6, skippedExpired: 1, skippedOptout: 2,
      sent: 6, delivered: 6, seen: 4, replied: 3, failed: 0, clicks: 0, status: 'Completed' },
    { id: 'c4', name: 'Back in stock — weekend', type: 'dm', template: tpl('tpl_seed_3'), audienceLabel: 'Tag · warm lead',
      sendAt: now + DAY, targeted: 52, planned: 18, skippedExpired: 31, skippedOptout: 3,
      sent: 0, delivered: 0, seen: 0, replied: 0, failed: 0, clicks: 0, status: 'Scheduled' },
    { id: 'c5', name: 'Flash sale carousel', type: 'dm', template: tpl('tpl_seed_1'), audienceLabel: 'Group · VIP Customers',
      sendAt: now - 9 * DAY, targeted: 80, planned: 31, skippedExpired: 44, skippedOptout: 5,
      sent: 0, delivered: 0, seen: 0, replied: 0, failed: 31, clicks: 0, status: 'Failed',
      error: 'Instagram could not fetch a card image (the link returned 404), so nothing was delivered.' },
  ]
}

const mid = i => `aWdfZAG1${(i * 7919 + 104729).toString(36).toUpperCase()}faXRlbToxOklHTWVzc2FnZAUlE${(i * 31).toString(36)}`
function seedLogs() {
  const now = Date.now()
  const names = ['Ananya Rao', 'Karthik Iyer', 'Meera Nair', 'Sneha Kapoor', 'Vikram Singh', 'Pooja Reddy', 'Arjun Das', 'Neha Gupta']
  const tp = ['New arrivals carousel', 'Support quick options', 'Back in stock', 'Comment thank-you']
  const st = ['seen', 'delivered', 'seen', 'delivered', 'seen', 'sent', 'failed', 'seen', 'delivered', 'seen', 'seen', 'failed', 'delivered', 'seen', 'delivered', 'seen', 'seen', 'delivered', 'sent', 'seen']
  return st.map((status, i) => {
    const n = names[i % names.length]
    return {
      id: `l${i}`, name: n, handle: `@${n.toLowerCase().replace(' ', '.')}`, tpl: tp[i % tp.length], mid: mid(i), status,
      resp: status === 'failed' ? (i % 2 ? 'Outside the 24-hour window' : 'Image could not be fetched') : 'Success',
      sentAt: now - (i * 3.4 + 0.6) * HOUR,
    }
  })
}

/* ── small pieces ──────────────────────────────────────────────────────── */
const STATUS_CFG = {
  Completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  Sending:   { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    ring: 'ring-blue-200' },
  Scheduled: { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   ring: 'ring-amber-200' },
  Failed:    { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     ring: 'ring-red-200' },
}
function StatusPill({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.Scheduled
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1', c.bg, c.text, c.ring)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot, status === 'Sending' && 'animate-pulse')}/>{status}
    </span>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className={clsx('rounded-lg border px-3 py-2', tone)}>
      <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
      <p className="text-[10px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}

const th = 'px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap'

/* ── recipients for the insights table ─────────────────────────────────── */
const POOL = ['Ananya Rao', 'Karthik Iyer', 'Meera Nair', 'Rohit Sharma', 'Divya Menon', 'Sneha Kapoor', 'Vikram Singh', 'Pooja Reddy',
  'Arjun Das', 'Neha Gupta', 'Ishaan Malhotra', 'Kavya Pillai', 'Aditya Verma', 'Riya Banerjee', 'Manish Joshi']
const handleOf = n => `@${n.toLowerCase().replace(/\s+/g, '.')}`

function genRecipients(c) {
  const skipLabel = o => (c.type === 'comments' ? (o === 'expired' ? 'Over 7 days' : 'Already replied') : (o === 'expired' ? 'Window closed' : 'Unsubscribed'))
  const live = c.status === 'Scheduled' ? 'Queued' : c.status === 'Sending' ? 'Sending' : null
  if (c.contacts) {
    let i = 0
    return c.contacts.map(x => {
      if (x.outcome !== 'sent') return { name: x.name, handle: x.handle, status: 'Skipped', reason: skipLabel(x.outcome), seen: false, replied: false }
      const k = i++
      if (live) return { name: x.name, handle: x.handle, status: live, seen: false, replied: false }
      if (k < c.failed) return { name: x.name, handle: x.handle, status: 'Failed', seen: false, replied: false }
      const j = k - c.failed
      return { name: x.name, handle: x.handle, status: 'Delivered', seen: j < c.seen, replied: j < c.replied }
    })
  }
  const n = Math.min(c.targeted, 30)
  const sc = n / Math.max(1, c.targeted)
  const skipped = Math.min(n, Math.round((c.skippedExpired + c.skippedOptout) * sc))
  const failed = Math.min(n - skipped, Math.round(c.failed * sc))
  const ok = n - skipped - failed
  const seen = Math.round(c.seen * sc), replied = Math.round(c.replied * sc)
  const expiredShare = c.skippedExpired / Math.max(1, c.skippedExpired + c.skippedOptout)
  return Array.from({ length: n }, (_, i) => {
    const name = POOL[i % POOL.length] + (i >= POOL.length ? ` ${Math.floor(i / POOL.length) + 1}` : '')
    const base = { name, handle: handleOf(name) }
    if (i < ok) {
      if (live) return { ...base, status: live, seen: false, replied: false }
      return { ...base, status: 'Delivered', seen: i < seen, replied: i < replied }
    }
    if (i < ok + failed) return { ...base, status: 'Failed', seen: false, replied: false }
    const k = i - ok - failed
    return { ...base, status: 'Skipped', reason: skipLabel(k < Math.round(skipped * expiredShare) ? 'expired' : 'optout'), seen: false, replied: false }
  })
}

/* ── campaign insights ─────────────────────────────────────────────────── */
function templateButtons(t) {
  if (!t) return []
  const list = t.kind === 'generic' ? t.elements.flatMap(e => e.buttons || []) : (t.buttons || [])
  const seen = new Set()
  return list.filter(b => (seen.has(b.title) ? false : seen.add(b.title)))
}

function CampaignInsights({ campaign: c, onBack, onFollowUp }) {
  const [tab, setTab] = useState('overview')
  const [rtab, setRtab] = useState('All')
  const recipients = useMemo(() => genRecipients(c), [c])
  const skipped = c.skippedExpired + c.skippedOptout
  const base = c.planned
  const btns = templateButtons(c.template)
  const dm = c.type === 'dm'

  const counts = {
    All: recipients.length,
    Delivered: recipients.filter(r => r.status === 'Delivered').length,
    Seen: recipients.filter(r => r.seen).length,
    Replied: recipients.filter(r => r.replied).length,
    Skipped: recipients.filter(r => r.status === 'Skipped').length,
    Failed: recipients.filter(r => r.status === 'Failed').length,
  }
  const visible = recipients.filter(r => rtab === 'All' ? true : rtab === 'Delivered' ? r.status === 'Delivered' : rtab === 'Seen' ? r.seen
    : rtab === 'Replied' ? r.replied : rtab === 'Skipped' ? r.status === 'Skipped' : r.status === 'Failed')

  function exportCsv() {
    const q = s => `"${String(s).replace(/"/g, '""')}"`
    const csv = ['Name,Handle,Status,Reason,Seen,Replied', ...recipients.map(r =>
      [r.name, r.handle, r.status, r.reason || '', r.seen ? 'Yes' : 'No', r.replied ? 'Yes' : 'No'].map(q).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${c.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-recipients.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
          <ChevronLeft size={16}/> Back to Campaigns
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900 truncate max-w-[400px]">{c.name}</span>
        <StatusPill status={c.status}/>
      </div>

      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
        {['overview', 'recipients'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-3.5 py-1.5 text-xs font-semibold capitalize rounded-lg transition-all', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{t}</button>
        ))}
      </div>

      {c.error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5"/>
          <div><p className="text-xs font-bold text-red-800">This campaign failed</p><p className="text-[11.5px] text-red-700 mt-0.5">{c.error}</p></div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: dm ? 'Targeted' : 'Comments', value: c.targeted, color: 'text-slate-900', bar: 'bg-slate-300', p: 100 },
              { label: 'Sent',       value: c.sent || (c.status === 'Failed' ? 0 : c.planned), color: 'text-blue-600', bar: 'bg-blue-500', p: pct(c.sent || c.planned, c.targeted) },
              { label: 'Delivered',  value: c.delivered, color: 'text-emerald-600', bar: 'bg-emerald-500', p: pct(c.delivered, base) },
              { label: 'Seen',       value: c.seen,      color: 'text-teal-600',    bar: 'bg-teal-500',    p: pct(c.seen, base) },
              { label: 'Replied',    value: c.replied,   color: 'text-violet-600',  bar: 'bg-violet-500',  p: pct(c.replied, base) },
              { label: 'Skipped',    value: skipped,     color: 'text-amber-600',   bar: 'bg-amber-400',   p: pct(skipped, c.targeted) },
            ].map(k => (
              <div key={k.label} className="card p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{k.label}</p>
                <p className={clsx('text-xl font-bold leading-none mb-1', k.color)}>{k.value.toLocaleString()}</p>
                <div className="h-1 bg-slate-100 rounded-full mb-1.5"><div className={clsx('h-full rounded-full', k.bar)} style={{ width: `${k.p}%` }}/></div>
                <p className="text-[10px] text-slate-400">{k.p}%</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 card p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-4">Delivery Funnel</h3>
              <div className="space-y-3">
                {[
                  { label: dm ? 'Targeted' : 'Comments', value: c.targeted, p: 100, bar: 'bg-slate-300' },
                  { label: 'Reachable', value: c.planned, p: pct(c.planned, c.targeted), bar: 'bg-blue-400' },
                  { label: 'Delivered', value: c.delivered, p: pct(c.delivered, c.targeted), bar: 'bg-emerald-500' },
                  { label: 'Seen', value: c.seen, p: pct(c.seen, c.targeted), bar: 'bg-teal-500' },
                  { label: 'Replied', value: c.replied, p: pct(c.replied, c.targeted), bar: 'bg-violet-500' },
                  ...(dm ? [{ label: 'Tapped', value: c.clicks, p: pct(c.clicks, c.targeted), bar: 'bg-pink-500' }] : []),
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">{f.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={clsx('h-full rounded-full transition-all', f.bar)} style={{ width: `${f.p}%` }}/></div>
                    <span className="text-xs font-semibold text-slate-700 w-9 text-right tabular-nums">{f.p}%</span>
                    <span className="text-xs text-slate-400 w-12 text-right tabular-nums">{f.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-4 leading-snug">
                Targeted → Reachable is where Instagram's rules apply: {dm ? 'contacts outside their 24-hour window or unsubscribed' : 'comments older than 7 days or already replied to'} are skipped, not queued.
              </p>
            </div>

            <div className="lg:col-span-2 card p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-4">Button Responses</h3>
              {btns.length > 0 ? (
                <div className="space-y-3">
                  {btns.map((b, i) => {
                    const taps = Math.round((c.clicks * (btns.length - i)) / ((btns.length * (btns.length + 1)) / 2))
                    return (
                      <div key={b.title + i}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-700 flex items-center gap-1.5 min-w-0">
                            {b.type === 'web_url' ? <Link2 size={11} className="text-slate-400 flex-shrink-0"/> : <Reply size={11} className="text-slate-400 flex-shrink-0"/>}
                            <span className="truncate">{b.title}</span>
                          </span>
                          <span className="text-slate-500 flex-shrink-0">{taps.toLocaleString()} {b.type === 'web_url' ? 'clicks' : 'taps'}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-pink-400 rounded-full" style={{ width: `${pct(taps, base)}%` }}/></div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{pct(taps, base)}% of delivered</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-20 text-slate-300"><MousePointerClick size={20}/><p className="text-xs mt-1">No buttons in this template</p></div>
              )}

              <div className="mt-4 pt-4 border-t border-surface-border">
                <p className="text-xs font-bold text-slate-700 mb-2">Skipped</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50"><p className="text-sm font-bold text-amber-700 tabular-nums">{c.skippedExpired}</p><p className="text-[10px] text-amber-700/80">{dm ? 'Window closed' : 'Over 7 days'}</p></div>
                  <div className="px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50"><p className="text-sm font-bold text-slate-600 tabular-nums">{c.skippedOptout}</p><p className="text-[10px] text-slate-500">{dm ? 'Unsubscribed' : 'Already replied'}</p></div>
                </div>
                {dm && c.replied > 0 && (
                  <button onClick={onFollowUp}
                    className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg border border-surface-border text-left hover:border-primary/40 hover:bg-primary-50 transition-all group">
                    <span className="text-[11px] font-medium text-slate-600 group-hover:text-primary">Follow up with people who replied</span>
                    <span className="text-[10px] font-bold text-slate-400">{c.replied}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 mb-1">{c.template.name}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{summarize(c.template)}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{dm ? 'Direct message' : 'Private reply'}</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{c.audienceLabel}</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{c.status === 'Scheduled' ? 'Sends' : 'Sent'} {fmt(c.sendAt)}</span>
                </div>
                {btns.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {btns.map(b => <span key={b.title} className="text-[10px] font-semibold text-primary border border-primary/30 px-2 py-0.5 rounded-full bg-primary/5">{b.title}</span>)}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0"><IgDmPreview template={c.template} fallbacks={c.fallbacks} scale={0.72}/></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'recipients' && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-border min-w-0">
            <div className="flex-1 overflow-x-auto min-w-0">
              <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
                {Object.keys(counts).map(t => (
                  <button key={t} onClick={() => setRtab(t)}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap', rtab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {t}
                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', rtab === t ? 'bg-primary/10 text-primary' : 'text-slate-400')}>{counts[t]}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-surface-border transition-colors whitespace-nowrap flex-shrink-0">
              <Download size={12}/> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="border-b border-surface-border bg-slate-50/60">
                <th className={clsx(th, 'px-5')}>Contact</th><th className={th}>Handle</th><th className={th}>Status</th><th className={th}>Seen</th><th className={th}>Replied</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-border">
                {visible.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-400">Nobody in this view</td></tr>}
                {visible.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">{r.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                        <span className="text-xs font-medium text-slate-800">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.handle}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        r.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : r.status === 'Failed' ? 'bg-red-50 text-red-700'
                          : r.status === 'Skipped' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')}>
                        {r.status === 'Skipped' ? `Skipped · ${r.reason}` : r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.seen ? <Check size={14} className="text-teal-500"/> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">{r.replied ? <Check size={14} className="text-violet-500"/> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.targeted > recipients.length && (
            <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-surface-border bg-slate-50/40">Showing a sample of {recipients.length} of {c.targeted.toLocaleString()} contacts.</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── quick send ────────────────────────────────────────────────────────── */
function QuickSendModal({ templates, contacts, onClose, onSent }) {
  const [search, setSearch] = useState('')
  const [contactId, setContactId] = useState(null)
  const [tplId, setTplId] = useState(null)
  const [sending, setSending] = useState(false)
  const now = Date.now()

  const ready = templates.filter(t => t.status === 'ready')
  const list = contacts.filter(c => {
    const q = search.trim().toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q)
  }).map(c => ({ c, w: windowState(c, now) }))
  const contact = contacts.find(c => c.id === contactId)
  const tpl = templates.find(t => t.id === tplId)
  const preview = tpl && contact ? personalizeTemplate(tpl, contact) : tpl
  const ok = contact && tpl && windowState(contact, now).key === 'eligible'

  async function send() {
    if (!ok) return
    setSending(true)
    await new Promise(r => setTimeout(r, 900))
    onSent(contact, tpl)
    onClose()
  }

  return igPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quick Send</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Send one template to one contact — no campaign needed</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-surface-hover"><X size={16}/></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-5">
          <div className="md:col-span-3 p-5 space-y-5 md:border-r border-surface-border">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">1 · Contact</p>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input className="w-full pl-9 pr-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-slate-400"
                  placeholder="Search name or @handle…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <div className="border border-surface-border rounded-xl divide-y divide-surface-border max-h-52 overflow-y-auto">
                {list.length === 0 && <p className="text-xs text-slate-400 text-center py-5">No contacts found</p>}
                {list.map(({ c, w }) => {
                  const off = w.key !== 'eligible'
                  return (
                    <button key={c.id} disabled={off} onClick={() => setContactId(c.id)}
                      className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors', contactId === c.id ? 'bg-primary/5' : off ? 'opacity-55 cursor-not-allowed' : 'hover:bg-slate-50')}>
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{c.avatar}</div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p><p className="text-[10px] text-slate-400 truncate">{c.handle}</p></div>
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', CHIP[w.key])}>{w.label}</span>
                      {contactId === c.id && <CheckCircle2 size={14} className="text-primary flex-shrink-0"/>}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-1.5">Only contacts who messaged you in the last 24 hours can be selected. For anyone else, wait for them to write first.</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">2 · Template</p>
              <div className="border border-surface-border rounded-xl divide-y divide-surface-border max-h-44 overflow-y-auto">
                {ready.length === 0 && <p className="text-xs text-slate-400 text-center py-5">No ready templates yet</p>}
                {ready.map(t => (
                  <button key={t.id} onClick={() => setTplId(t.id)}
                    className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-l-2', tplId === t.id ? 'bg-primary/5 border-primary' : 'border-transparent hover:bg-slate-50')}>
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', KIND_TONE[t.kind])}><FileText size={12}/></div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800 truncate">{t.name}</p><p className="text-[10.5px] text-slate-400 truncate">{summarize(t)}</p></div>
                    {tplId === t.id && <CheckCircle2 size={14} className="text-primary flex-shrink-0"/>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="md:col-span-2 bg-slate-50 p-5 flex flex-col items-center">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 w-full">Preview{contact ? ` · ${contact.name.split(' ')[0]}` : ''}</p>
            {tpl ? <IgDmPreview template={preview} scale={0.7}/> : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 text-center py-10"><FileText size={22}/><p className="text-[11px] mt-2">Select a template</p></div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={send} disabled={!ok || sending} className="btn-primary text-xs px-5 flex items-center gap-1.5 disabled:opacity-40">
            <Send size={12}/> {sending ? 'Sending…' : 'Send now'}
          </button>
        </div>
      </div>
    </div>)
}

/* ── template logs ─────────────────────────────────────────────────────── */
const LOG_STATUS = {
  sent:      { label: 'Sent',      color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  delivered: { label: 'Delivered', color: 'bg-blue-50 text-blue-600',       dot: 'bg-blue-400' },
  seen:      { label: 'Seen',      color: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400' },
  failed:    { label: 'Failed',    color: 'bg-red-50 text-red-600',         dot: 'bg-red-400' },
}

function TemplateLogs({ logs }) {
  const [search, setSearch] = useState('')
  const [statusFil, setStatusFil] = useState('all')
  const [tplFil, setTplFil] = useState('all')
  const [page, setPage] = useState(1)
  const [copied, setCopied] = useState(null)

  const tpls = useMemo(() => [...new Set(logs.map(l => l.tpl))], [logs])
  const filtered = useMemo(() => logs.filter(l => {
    if (statusFil !== 'all' && l.status !== statusFil) return false
    if (tplFil !== 'all' && l.tpl !== tplFil) return false
    const q = search.trim().toLowerCase()
    return !q || l.handle.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.tpl.toLowerCase().includes(q) || l.mid.toLowerCase().includes(q)
  }), [logs, search, statusFil, tplFil])
  useEffect(() => setPage(1), [search, statusFil, tplFil])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const count = s => logs.filter(l => l.status === s).length

  function copy(id, text) {
    navigator.clipboard?.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sent', value: logs.length, Icon: Send, color: 'text-slate-500', bg: 'bg-slate-50' },
          { label: 'Delivered', value: count('delivered') + count('seen'), Icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Seen', value: count('seen'), Icon: MailOpen, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Failed', value: count('failed'), Icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-50' },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}><Icon size={15} className={color}/></div>
            <div><p className="text-[18px] font-bold text-slate-900 leading-tight">{value}</p><p className="text-[10px] text-slate-400 font-medium">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search handle, template or message ID…"
              className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-slate-50 border border-surface-border rounded-lg focus:outline-none focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={10}/></button>}
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect value={tplFil} onChange={e => setTplFil(e.target.value)} sm>
              <option value="all">All templates</option>
              {tpls.map(t => <option key={t} value={t}>{t}</option>)}
            </NativeSelect>
            <NativeSelect value={statusFil} onChange={e => setStatusFil(e.target.value)} sm>
              <option value="all">All statuses</option>
              {Object.entries(LOG_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </NativeSelect>
          </div>
          <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">{filtered.length} log{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-surface-border bg-slate-50/60">
              {['Receiver', 'Template', 'Message ID', 'Status', 'Response', 'Sent At'].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-surface-border">
              {shown.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <History size={28} className="text-slate-200 mx-auto mb-3"/>
                  <p className="text-[13px] font-semibold text-slate-400">No logs found</p><p className="text-[11px] text-slate-300 mt-1">Try adjusting your filters</p>
                </td></tr>
              ) : shown.map(l => {
                const st = LOG_STATUS[l.status]
                return (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">{l.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                        <div><p className="text-[12px] font-semibold text-slate-700 leading-tight">{l.name}</p><p className="text-[10px] text-slate-400">{l.handle}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><span className="text-[11px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-md whitespace-nowrap">{l.tpl}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 max-w-[200px]">
                        <span className="text-[11px] text-slate-500 font-mono truncate">{l.mid.substring(0, 26)}…</span>
                        <button onClick={() => copy(l.id, l.mid)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Copy message ID">
                          {copied === l.id ? <Check size={10} className="text-emerald-500"/> : <Copy size={10}/>}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold', st.color)}><span className={clsx('w-1.5 h-1.5 rounded-full', st.dot)}/>{st.label}</span>
                    </td>
                    <td className="px-5 py-3"><span className={clsx('text-[11px] font-medium whitespace-nowrap', l.resp === 'Success' ? 'text-emerald-600' : 'text-red-500')}>{l.resp}</span></td>
                    <td className="px-5 py-3 whitespace-nowrap"><span className="text-[11px] text-slate-500 tabular-nums">{fmt(l.sentAt)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
            <span className="text-[11px] text-slate-400">Page {page} of {pages} · {filtered.length} results</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover disabled:opacity-40"><ChevronLeft size={13}/></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className={clsx('w-7 h-7 rounded-lg text-[11px] font-semibold transition-colors', p === page ? 'bg-primary text-white' : 'border border-surface-border bg-white text-slate-600 hover:bg-surface-hover')}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover disabled:opacity-40"><ChevronRight size={13}/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── the page ──────────────────────────────────────────────────────────── */
export default function InstagramBroadcasts() {
  const [templates, setTemplates] = useState(loadTemplates)
  const [campaigns, setCampaigns] = useState(() => seedCampaigns(loadTemplates()))
  const [logs, setLogs] = useState(() => seedLogs())
  const [mainView, setMainView] = useState('campaigns') // campaigns | templates | logs
  const [view, setView] = useState('list')              // list | insights
  const [activeId, setActiveId] = useState(null)
  const [builder, setBuilder] = useState(null)          // { initial } | null
  const [wizard, setWizard] = useState(null)            // { template } | null
  const [showQuickSend, setShowQuickSend] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [dateRange, setDateRange] = useState('Last 30 days')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')
  const timers = useRef([])

  useEffect(() => saveTemplates(templates), [templates])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function flash(msg) {
    setToast(msg)
    timers.current.push(setTimeout(() => setToast(''), 3500))
  }

  /* templates */
  function saveTemplate(t) {
    const now = new Date().toISOString()
    setTemplates(list => t.id
      ? list.map(x => x.id === t.id ? { ...x, ...t, updatedAt: now } : x)
      : [{ ...t, id: `tpl_${Date.now()}`, createdAt: now, updatedAt: now, sent: 0, seen: 0 }, ...list])
    setBuilder(null)
    setMainView('templates')
    flash(t.status === 'draft' ? 'Draft saved' : 'Template saved')
  }
  function duplicateTemplate(t) {
    const now = new Date().toISOString()
    setTemplates(list => [{ ...structuredClone(t), id: `tpl_${Date.now()}`, name: `${t.name} (copy)`, status: 'draft', createdAt: now, updatedAt: now, sent: 0, seen: 0 }, ...list])
    flash('Template duplicated as a draft')
  }
  const deleteTemplate = id => { setTemplates(l => l.filter(t => t.id !== id)); flash('Template deleted') }
  const deleteMany = ids => { setTemplates(l => l.filter(t => !ids.includes(t.id))); flash(`${ids.length} template${ids.length > 1 ? 's' : ''} deleted`) }

  /* campaigns */
  function makeLogs(c, n = 8) {
    const sentRows = (c.contacts || []).filter(x => x.outcome === 'sent').slice(0, n)
    return sentRows.map((x, i) => ({
      id: `l_${c.id}_${i}`, name: x.name, handle: x.handle, tpl: c.template.name, mid: mid(Date.now() % 9973 + i),
      status: 'sent', resp: 'Success', sentAt: c.sendAt,
    }))
  }
  function handleCreated(c) {
    setCampaigns(p => [c, ...p])
    setPage(1)
    setActiveTab('All')
    if (c.status === 'Sending') {
      setLogs(l => [...makeLogs(c), ...l])
      timers.current.push(setTimeout(() => finish(c), 2500))
    }
    flash(c.status === 'Sending' ? `Sending to ${c.planned} ${c.type === 'dm' ? 'contact' : 'comment'}${c.planned === 1 ? '' : 's'} · ${c.targeted - c.planned} skipped` : `Scheduled for ${fmt(c.sendAt)}`)
  }
  function finish(c) {
    const seen = Math.round(c.planned * 0.62)
    setCampaigns(p => p.map(x => x.id !== c.id ? x : {
      ...x, status: 'Completed', sent: c.planned, delivered: c.planned, seen,
      replied: Math.round(c.planned * 0.2), clicks: c.type === 'dm' ? Math.round(c.planned * 0.35) : 0,
    }))
    setTemplates(l => l.map(t => t.id === c.template.id ? { ...t, sent: (t.sent || 0) + c.planned, seen: (t.seen || 0) + seen } : t))
    setLogs(l => l.map(x => x.id.startsWith(`l_${c.id}_`) ? { ...x, status: 'delivered' } : x))
  }
  function handleQuickSent(contact, tpl) {
    setLogs(l => [{
      id: `l_q_${Date.now()}`, name: contact.name, handle: contact.handle, tpl: tpl.name, mid: mid(Date.now() % 9973),
      status: 'delivered', resp: 'Success', sentAt: Date.now(),
    }, ...l])
    setTemplates(list => list.map(t => t.id === tpl.id ? { ...t, sent: (t.sent || 0) + 1 } : t))
    flash(`Sent “${tpl.name}” to ${contact.name}`)
  }

  /* derived */
  const rangeMs = { 'Last 7 days': 7 * DAY, 'Last 30 days': 30 * DAY, 'Last 90 days': 90 * DAY, 'All time': Infinity }[dateRange]
  const inRange = useMemo(() => campaigns.filter(c => c.status === 'Scheduled' || Date.now() - c.sendAt <= rangeMs), [campaigns, rangeMs])

  const totals = inRange.reduce((a, c) => ({
    sent: a.sent + c.delivered + c.failed, delivered: a.delivered + c.delivered, seen: a.seen + c.seen, replied: a.replied + c.replied,
    sending: a.sending + (c.status === 'Sending' ? c.planned : 0), failed: a.failed + c.failed,
    skipped: a.skipped + c.skippedExpired + c.skippedOptout, queued: a.queued + (c.status === 'Scheduled' ? 1 : 0),
  }), { sent: 0, delivered: 0, seen: 0, replied: 0, sending: 0, failed: 0, skipped: 0, queued: 0 })

  const tabCounts = STATUS_TABS.reduce((acc, t) => { acc[t] = t === 'All' ? inRange.length : inRange.filter(c => c.status === t).length; return acc }, {})
  const filtered = inRange.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) && (activeTab === 'All' || c.status === activeTab))
  useEffect(() => setPage(1), [search, activeTab, dateRange])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /* health cards */
  const health = useMemo(() => {
    const now = Date.now()
    const active = INIT_CONTACTS.filter(c => c.status === 'active')
    const open = active.filter(c => windowState(c, now).key === 'eligible')
    const nextLeft = open.length ? Math.min(...open.map(c => windowState(c, now).left)) : 0
    const done = campaigns.filter(c => c.status === 'Completed' || c.status === 'Failed').slice(0, 7).reverse()
    const rates = done.map(c => pct(c.delivered, c.delivered + c.failed))
    const dl = totals.delivered, fl = totals.failed
    const rate = pct(dl, dl + fl)
    const all = POSTS.flatMap(p => p.comments)
    const replyable = all.filter(cm => commentState(cm) === 'ok')
    const expiring = replyable.filter(cm => cm.ageH >= 144).length
    const byDay = Array.from({ length: 7 }, (_, d) => replyable.filter(cm => Math.floor(cm.ageH / 24) === d).length)
    return { active: active.length, open: open.length, nextLeft, rates, rate, replyable: replyable.length, expiring, byDay }
  }, [campaigns, totals.delivered, totals.failed])

  const activeCampaign = campaigns.find(c => c.id === activeId)

  if (builder) return <IgTemplateBuilder initial={builder.initial} onBack={() => setBuilder(null)} onSave={saveTemplate}/>

  if (view === 'insights' && activeCampaign) {
    return (
      <div className="animate-fade-in">
        <CampaignInsights campaign={activeCampaign} onBack={() => setView('list')} onFollowUp={() => { setView('list'); setWizard({ template: null }) }}/>
        {wizard && <IgCampaignWizard templates={templates} contacts={INIT_CONTACTS} groups={INIT_GROUPS} initialTemplate={wizard.template} onClose={() => setWizard(null)} onCreated={handleCreated}/>}
      </div>
    )
  }

  const readyCount = templates.filter(t => t.status === 'ready').length
  const hrs = ms => { const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m` }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-[15px] font-bold text-slate-900">{mainView === 'templates' ? 'Message Templates' : mainView === 'logs' ? 'Template Logs' : 'Broadcasts'}</h1>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {mainView === 'templates' ? `${templates.length} templates` : mainView === 'logs' ? `${logs.length} logs` : `${campaigns.length} campaigns`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {mainView === 'templates' ? 'Create and manage your Instagram message templates'
              : mainView === 'logs' ? 'Track every template message sent from your Instagram account'
                : "Send targeted Instagram campaigns to contacts inside Meta's 24-hour window"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          {mainView === 'campaigns' ? (
            <>
              <NativeSelect value={dateRange} onChange={e => setDateRange(e.target.value)} sm>
                {['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'].map(o => <option key={o} value={o}>{o}</option>)}
              </NativeSelect>
              <button onClick={() => setShowQuickSend(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary-50 text-primary text-xs font-semibold hover:bg-primary-100 hover:border-primary/50 transition-colors whitespace-nowrap flex-shrink-0">
                <Send size={12}/> Quick Send
              </button>
              <button onClick={() => setWizard({ template: null })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap flex-shrink-0">
                <Plus size={13}/> New Campaign
              </button>
            </>
          ) : mainView === 'templates' ? (
            <button onClick={() => setBuilder({ initial: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm whitespace-nowrap">
              <Plus size={13}/> Create Template
            </button>
          ) : null}
        </div>
      </div>

      {/* Section switcher */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
        {[['campaigns', 'Campaigns', Send], ['templates', 'Templates', FileText], ['logs', 'Template Logs', History]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setMainView(key)}
            className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all', mainView === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Icon size={12}/> {label}
          </button>
        ))}
      </div>

      {mainView === 'logs' && <TemplateLogs logs={logs}/>}

      {mainView === 'templates' && (
        <IgTemplatesView templates={templates}
          onCreate={() => setBuilder({ initial: null })} onEdit={t => setBuilder({ initial: t })}
          onDuplicate={duplicateTemplate} onDelete={deleteTemplate} onDeleteMany={deleteMany}
          onUse={t => { setMainView('campaigns'); setWizard({ template: t }) }}/>
      )}

      {mainView === 'campaigns' && (
        <>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <ShieldCheck size={14} className="text-blue-500 flex-shrink-0 mt-0.5"/>
            <p className="text-[11.5px] text-blue-900 leading-relaxed">
              <b>How Instagram differs from WhatsApp:</b> you can only message someone within 24 hours of their last message to you, and templates can't reopen a closed window.
              People outside it are skipped and counted — never queued. To reach someone who hasn't written first, send a <b>private reply to their comment</b> (one per comment, within 7 days).
            </p>
          </div>

          {/* Account health */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Reach</p><p className="text-[11px] font-semibold text-slate-900">Reachable right now</p></div>
                <Users size={13} className="text-slate-300 flex-shrink-0"/>
              </div>
              <div className="mb-2.5">
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-slate-400">Window open</span>
                  <span className="font-semibold text-slate-700">{health.open} <span className="text-slate-400 font-normal">/ {health.active}</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct(health.open, health.active)}%` }}/></div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', health.open ? 'bg-emerald-400' : 'bg-slate-300')}/>
                <p className="text-[10px] text-slate-500">{health.open ? `Next window closes in ${hrs(health.nextLeft)}` : 'Nobody has messaged you in the last 24h'}</p>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Delivery</p><p className="text-[11px] font-semibold text-slate-900">Delivery health</p></div>
                <Shield size={13} className={clsx('flex-shrink-0', health.rate >= 90 ? 'text-emerald-500' : 'text-amber-500')}/>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className={clsx('w-8 h-8 rounded-full ring-2 ring-offset-1 flex items-center justify-center flex-shrink-0', health.rate >= 90 ? 'bg-emerald-50 ring-emerald-400' : 'bg-amber-50 ring-amber-400')}>
                  <div className={clsx('w-3 h-3 rounded-full', health.rate >= 90 ? 'bg-emerald-400' : 'bg-amber-400')}/>
                </div>
                <div>
                  <p className={clsx('text-sm font-bold leading-none', health.rate >= 90 ? 'text-emerald-600' : 'text-amber-600')}>{health.rate}%</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{health.rate >= 95 ? 'Excellent delivery' : health.rate >= 90 ? 'Healthy delivery' : 'Check failed campaigns'}</p>
                </div>
              </div>
              <div className="flex items-end gap-0.5 h-6">
                {(health.rates.length ? health.rates : [0]).map((h, i, a) => (
                  <div key={i} className={clsx('flex-1 rounded-sm', i >= a.length - 3 ? (h >= 90 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-slate-200')} style={{ height: `${Math.max(8, h)}%` }}/>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Comments</p><p className="text-[11px] font-semibold text-slate-900">Replyable comments</p></div>
                <Zap size={13} className="text-amber-400 flex-shrink-0"/>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xl font-bold text-slate-900">{health.replyable}</p>
                <p className="text-[11px] text-slate-400">{health.expiring ? `${health.expiring} expire within 24h` : 'within the 7-day limit'}</p>
              </div>
              <div className="flex items-center gap-1">
                {health.byDay.map((n, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1" title={`${n} comment${n === 1 ? '' : 's'} · ${i === 0 ? 'today' : `${i}d old`}`}>
                    <div className={clsx('w-full aspect-square rounded-full flex items-center justify-center', n ? (i >= 6 ? 'bg-red-400' : 'bg-amber-400') : 'bg-slate-100')}>
                      {n ? <span className="text-[9px] font-bold text-white">{n}</span> : <span className="w-1 h-1 rounded-full bg-slate-300"/>}
                    </div>
                    <span className="text-[9px] font-medium text-slate-400">{i === 0 ? 'Now' : `${i}d`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Primary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Send, label: 'Total Sent', value: totals.sent, sub: `${pct(totals.delivered, totals.sent)}% delivery rate`, iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
              { icon: CheckCircle2, label: 'Delivered', value: totals.delivered, sub: `of ${totals.sent.toLocaleString()} sent`, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
              { icon: Eye, label: 'Seen', value: totals.seen, sub: `${pct(totals.seen, totals.delivered)}% seen rate`, iconBg: 'bg-teal-50', iconColor: 'text-teal-500' },
              { icon: CornerUpLeft, label: 'Replied', value: totals.replied, sub: `${pct(totals.replied, totals.delivered)}% reply rate`, iconBg: 'bg-violet-50', iconColor: 'text-violet-500' },
            ].map(({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
              <div key={label} className="card p-4">
                <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center mb-3', iconBg)}><Icon size={14} className={iconColor}/></div>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</p>
                <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-surface-border sm:divide-x gap-y-3">
              {[
                { label: 'Currently Sending', value: totals.sending, color: 'text-blue-600' },
                { label: 'Failed', value: totals.failed, color: 'text-red-600' },
                { label: 'Skipped (outside window)', value: totals.skipped, color: 'text-amber-600' },
                { label: 'Scheduled', value: totals.queued, color: 'text-slate-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-6 first:pl-0 last:pr-0 flex items-center gap-3">
                  <span className={clsx('text-sm font-bold tabular-nums', color)}>{value.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campaigns table */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-2 border-b border-surface-border gap-3 flex-wrap">
              <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
                {STATUS_TABS.map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={clsx('flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap', activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {tab}
                    {tabCounts[tab] > 0 && (
                      <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500')}>{tabCounts[tab]}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative py-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                  placeholder="Search campaigns…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-surface-border bg-slate-50/60">
                  <th className={clsx(th, 'px-5')}>Campaign</th><th className={th}>Audience</th>
                  <th className={clsx(th, 'min-w-[180px]')}>Performance</th><th className={th}>Status</th><th className={th}>Date</th>
                  <th className={clsx(th, 'px-5 text-right')}>Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-border">
                  {shown.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', KIND_TONE[c.template.kind])}>
                            {c.type === 'dm' ? <FileText size={13}/> : <MessageCircle size={13}/>}
                          </div>
                          <div className="min-w-0">
                            <button onClick={() => { setActiveId(c.id); setView('insights') }} className="text-left group/name block">
                              <p className="text-xs font-semibold text-slate-900 group-hover/name:text-primary transition-colors max-w-[220px] truncate">{c.name}</p>
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', c.type === 'dm' ? 'bg-pink-50 text-pink-600' : 'bg-sky-50 text-sky-600')}>
                                {c.type === 'dm' ? 'DM' : 'COMMENTS'}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{c.template.name}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs font-semibold text-slate-800">{c.planned.toLocaleString()} <span className="font-normal text-slate-400">reachable</span></p>
                        <p className="text-[10px] text-slate-400">{(c.skippedExpired + c.skippedOptout).toLocaleString()} skipped · {c.targeted.toLocaleString()} targeted</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          {[['Delivered', pct(c.delivered, c.planned), 'bg-emerald-400'], ['Seen', pct(c.seen, c.planned), 'bg-teal-400'], ['Replied', pct(c.replied, c.planned), 'bg-violet-400']].map(([label, v, bar]) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 w-14 flex-shrink-0">{label}</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={clsx('h-full rounded-full', bar)} style={{ width: `${v}%` }}/></div>
                              <span className="text-[10px] font-semibold text-slate-600 w-7 text-right tabular-nums">{v}%</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusPill status={c.status}/></td>
                      <td className="px-4 py-4"><p className="text-xs text-slate-500 whitespace-nowrap">{fmt(c.sendAt)}</p></td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => { setActiveId(c.id); setView('insights') }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors">
                          <BarChart2 size={12}/> Analytics
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><Inbox size={20} className="text-slate-300"/></div>
                      <p className="text-xs font-semibold text-slate-500">No campaigns found</p>
                      <p className="text-xs text-slate-400 mt-1">{search ? 'Try adjusting your search' : 'Create your first campaign to get started'}</p>
                      {!search && readyCount > 0 && (
                        <button onClick={() => setWizard({ template: null })} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-sm">
                          <Plus size={12}/> New Campaign
                        </button>
                      )}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-slate-50/40">
              <p className="text-xs text-slate-400">Showing <span className="font-semibold text-slate-600">{shown.length}</span> of <span className="font-semibold text-slate-600">{filtered.length}</span> campaigns</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30"><ChevronLeft size={14}/></button>
                <button className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold">{page}</button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 disabled:opacity-30"><ChevronRight size={14}/></button>
              </div>
            </div>
          </div>
        </>
      )}

      {wizard && <IgCampaignWizard templates={templates} contacts={INIT_CONTACTS} groups={INIT_GROUPS} initialTemplate={wizard.template} onClose={() => setWizard(null)} onCreated={handleCreated}/>}
      {showQuickSend && <QuickSendModal templates={templates} contacts={INIT_CONTACTS} onClose={() => setShowQuickSend(false)} onSent={handleQuickSent}/>}

      {toast && igPortal(
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl animate-fade-in">
          <CheckCircle2 size={14} className="text-emerald-400"/> {toast}
        </div>)}
    </div>
  )
}
