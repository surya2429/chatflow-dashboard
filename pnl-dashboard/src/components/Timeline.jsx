import clsx from 'clsx'
import { Check, MapPin, AlertTriangle, Ban, PackageCheck } from 'lucide-react'
import { MILESTONE_RAIL, milestoneLabel } from '../lib/domain'
import { fmtDateTime, fmtAgo } from '../lib/format'

const ICON = {
  delivered: PackageCheck,
  exception: AlertTriangle,
  delivery_attempted: AlertTriangle,
  cancelled: Ban,
}

/** Full tracking history — newest first is how operators read it, so we reverse for display. */
export function Timeline({ milestones }) {
  const items = [...milestones].reverse()
  return (
    <ol className="relative">
      {items.map((m, i) => {
        const Icon = ICON[m.code] || (i === 0 ? MapPin : Check)
        const bad = m.code === 'exception' || m.code === 'delivery_attempted' || m.code === 'cancelled'
        const latest = i === 0
        return (
          <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < items.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" aria-hidden />}
            <span className={clsx(
              'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2',
              bad ? 'border-red-200 bg-red-50 text-red-600'
                : latest ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-emerald-200 bg-emerald-50 text-emerald-600'
            )}>
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-semibold text-navy-900">{milestoneLabel(m.code)}</p>
                <p className="text-xs text-slate-500 tnum">{fmtDateTime(m.at)}</p>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                {m.location}
                {m.hub ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{m.hub}</span> : null}
              </p>
              {m.note && <p className="mt-1 text-sm text-amber-700">{m.note}</p>}
              <p className="mt-1 text-xs text-slate-400">Recorded by {m.by} · {fmtAgo(m.at)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Horizontal progress rail for the happy path — the customer-facing view.
 * `compact` drops the per-step captions so the rail still fits a narrow side panel.
 */
export function TrackingRail({ milestones, cancelled, compact }) {
  const seen = new Set(milestones.map((m) => m.code))
  const steps = MILESTONE_RAIL.filter((c) => c !== 'customs_clearance' || seen.has('customs_clearance'))
  const lastIdx = steps.reduce((acc, c, i) => (seen.has(c) ? i : acc), 0)

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Ban size={15} className="text-slate-400" /> This shipment was cancelled and is no longer moving.
      </div>
    )
  }

  if (compact) {
    return (
      <div>
        <div className="flex items-center gap-1">
          {steps.map((c, i) => (
            <span
              key={c}
              className={clsx('h-1.5 flex-1 rounded-full',
                i === lastIdx ? 'bg-navy-900' : i < lastIdx ? 'bg-navy-400' : 'bg-slate-200')}
            />
          ))}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="truncate text-xs font-semibold text-navy-900">{milestoneLabel(steps[lastIdx])}</p>
          <p className="shrink-0 text-[11px] text-slate-400 tnum">Step {lastIdx + 1} of {steps.length}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1">
      {steps.map((c, i) => {
        const done = i <= lastIdx
        const current = i === lastIdx
        return (
          <div key={c} className="flex min-w-[92px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={clsx('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done ? 'bg-navy-900' : 'bg-slate-200')} />
              <span className={clsx(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold',
                current ? 'border-navy-900 bg-navy-900 text-white'
                  : done ? 'border-navy-900 bg-white text-navy-900'
                  : 'border-slate-200 bg-white text-slate-300'
              )}>
                {done && !current ? <Check size={12} /> : i + 1}
              </span>
              <span className={clsx('h-0.5 flex-1', i === steps.length - 1 ? 'bg-transparent' : i < lastIdx ? 'bg-navy-900' : 'bg-slate-200')} />
            </div>
            <p className={clsx('mt-2 px-1 text-[11px] leading-tight', current ? 'font-semibold text-navy-900' : done ? 'text-navy-700' : 'text-slate-400')}>
              {milestoneLabel(c)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
