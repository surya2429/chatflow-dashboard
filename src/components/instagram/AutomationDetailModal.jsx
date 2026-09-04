import { useState } from 'react'
import { X, Pencil, TrendingUp, Users } from 'lucide-react'
import clsx from 'clsx'
import { SegmentedTabs, AutomationPerfCard, SubscribersTable, buildAutomationPerf, buildSubscribers, Toggle } from './shared'

const TABS = [
  { id: 'edit',        label: 'Edit',        icon: Pencil },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'subscribers', label: 'Subscribers', icon: Users },
]

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[11px] font-semibold text-slate-700 text-right">{value}</span>
    </div>
  )
}

export default function AutomationDetailModal({ rule, sourceMeta, onClose, onEdit, onToggle }) {
  const [tab, setTab] = useState('performance')
  const src = sourceMeta[rule.source]
  const perf = buildAutomationPerf([rule])[0]
  const subs = buildSubscribers(rule)
  const needsTarget = rule.source === 'comment' || rule.source === 'story_reply'
  const needsKeywords = rule.source === 'dm' || rule.source === 'comment'

  return (
    <div className="fixed inset-0 bg-slate-900/25 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-surface-border rounded-2xl w-full max-w-2xl shadow-modal flex flex-col max-h-[88vh] overflow-hidden">
        <div className="p-5 border-b border-surface-border flex-shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {src && (
                  <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5', src.color)}>
                    <src.icon size={9}/> {src.label}
                  </span>
                )}
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', rule.active ? 'bg-emerald-400' : 'bg-slate-300')}/>
                <span className="text-[10px] text-slate-400">{rule.active ? 'Active' : 'Paused'}</span>
              </div>
              <h3 className="text-[14px] font-bold text-slate-900 mt-1 truncate">{rule.name}</h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onToggle && <Toggle checked={rule.active} onChange={v => onToggle(rule.id, v)}/>}
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-surface-hover"><X size={15}/></button>
            </div>
          </div>
          <SegmentedTabs tabs={TABS} active={tab} onChange={setTab}/>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'edit' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-surface-border rounded-xl divide-y divide-surface-border">
                <SummaryRow label="Trigger source" value={src?.label}/>
                {needsTarget && (
                  <SummaryRow label="Applies to" value={rule.targetScope === 'all' ? 'All' : `${rule.targetIds.length} selected`}/>
                )}
                {needsKeywords && (
                  <SummaryRow label="Keywords" value={rule.keywords?.length ? rule.keywords.join(', ') : 'Any'}/>
                )}
                <SummaryRow label="Frequency cap" value={rule.frequencyCap === 'none' ? 'None' : rule.frequencyCap}/>
              </div>
              <button onClick={() => onEdit(rule)} className="btn-primary w-full justify-center">
                <Pencil size={13}/> Open Full Editor
              </button>
            </div>
          )}
          {tab === 'performance' && <AutomationPerfCard r={perf} sourceMeta={sourceMeta} detailed/>}
          {tab === 'subscribers' && <SubscribersTable subscribers={subs} totalTriggered={rule.stats.triggered}/>}
        </div>
      </div>
    </div>
  )
}
