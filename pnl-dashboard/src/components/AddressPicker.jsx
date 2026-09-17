import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { MapPin, Flag, Search, Check, ChevronDown, Building2, X } from 'lucide-react'
import { BRANCH_TYPES } from '../lib/domain'

/**
 * Picking where a consignment starts and ends is the first thing anyone does on this form,
 * and the hardest to get right: there are branches in eleven Nigerian cities plus five
 * overseas agents, and an operator on the phone needs to find one by city, by branch name
 * or by the three-letter code they read off a label.
 *
 * So the closed state reads like an address — area, city, country, code — and the open
 * state is a search box with grouped, keyboard-navigable results. Pickup is green and
 * delivery is red throughout, matching the step markers, so the two never blur together.
 */

const TONES = {
  pickup: {
    ring: 'border-emerald-300 bg-emerald-50/40',
    ringIdle: 'border-slate-200 bg-white hover:border-emerald-300',
    icon: 'bg-emerald-500 text-white',
    dot: 'bg-emerald-500',
    label: 'text-emerald-700',
    Icon: MapPin,
  },
  delivery: {
    ring: 'border-rose-300 bg-rose-50/40',
    ringIdle: 'border-slate-200 bg-white hover:border-rose-300',
    icon: 'bg-rose-500 text-white',
    dot: 'bg-rose-500',
    label: 'text-rose-700',
    Icon: Flag,
  },
}

/** Group results the way an operator thinks about the network. */
function group(branches) {
  const home = branches.filter((b) => b.country === 'Nigeria')
  const away = branches.filter((b) => b.country !== 'Nigeria')
  return [
    { label: 'Nigeria', items: home },
    { label: 'Overseas agents', items: away },
  ].filter((g) => g.items.length)
}

function SearchPanel({ anchorRect, branches, value, onPick, onClose, tone }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { inputRef.current && inputRef.current.focus() }, [])

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return branches
    return branches.filter((b) =>
      b.city.toLowerCase().includes(term)
      || b.name.toLowerCase().includes(term)
      || b.code.toLowerCase().includes(term)
      || b.country.toLowerCase().includes(term))
  }, [branches, q])

  // A flat list backs the keyboard cursor even though the display is grouped.
  const flat = useMemo(() => group(matches).flatMap((g) => g.items), [matches])
  useEffect(() => { setActive(0) }, [q])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) onPick(flat[active].code) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[data-active="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [active])

  const t = TONES[tone]
  const width = Math.max(anchorRect.width, 320)
  const spaceBelow = window.innerHeight - anchorRect.bottom
  const dropUp = spaceBelow < 320 && anchorRect.top > spaceBelow

  return createPortal(
    <>
      <div className="fixed inset-0 z-50" onMouseDown={onClose} />
      <div
        className="fixed z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop animate-pop-in"
        style={{
          width,
          left: Math.min(anchorRect.left, window.innerWidth - width - 12),
          top: dropUp ? undefined : anchorRect.bottom + 6,
          bottom: dropUp ? window.innerHeight - anchorRect.top + 6 : undefined,
        }}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search city, branch or code…"
            className="w-full border-0 bg-transparent p-0 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          {q && (
            <button onClick={() => setQ('')} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-navy-700" aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No branch matches “{q.trim()}”.
            </p>
          ) : group(matches).map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{g.label}</p>
              {g.items.map((b) => {
                const i = flat.indexOf(b)
                const selected = b.code === value
                return (
                  <button
                    key={b.code}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onPick(b.code)}
                    className={clsx('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      i === active ? 'bg-slate-100' : 'hover:bg-slate-50')}
                  >
                    <span className={clsx('grid h-7 w-8 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold',
                      selected ? t.icon : 'bg-slate-100 text-slate-500')}>
                      {b.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-navy-900">{b.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {b.city} · {b.country} · {BRANCH_TYPES[b.type] ? BRANCH_TYPES[b.type].label : b.type}
                      </span>
                    </span>
                    {selected && <Check size={15} className="shrink-0 text-emerald-600" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

export default function AddressPicker({
  tone = 'pickup', step, title, branches, value, onChange,
  address, onAddressChange, addressPlaceholder = 'Street, building, area', error,
}) {
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)
  const t = TONES[tone]
  const selected = branches.find((b) => b.code === value)

  const open = () => {
    if (cardRef.current) setRect(cardRef.current.getBoundingClientRect())
  }

  return (
    <div>
      {title && (
        <p className="step-head mb-1.5">
          <span className={clsx('step-dot', t.dot)} />
          {step ? <span className={t.label}>{step}</span> : null} {title}
        </p>
      )}

      <div
        ref={cardRef}
        className={clsx('rounded-xl border-2 transition-colors',
          selected ? t.ring : t.ringIdle,
          error && 'border-red-400')}
      >
        <button
          type="button"
          onClick={open}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-inset rounded-xl"
        >
          <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-sm', t.icon)}>
            <t.Icon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block truncate text-[15px] font-bold leading-tight text-navy-900">{selected.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {selected.city} · {selected.country}
                  <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                    {selected.code}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="block text-[15px] font-bold leading-tight text-slate-400">Choose a branch</span>
                <span className="block text-xs text-slate-400">Search by city, branch name or code</span>
              </>
            )}
          </span>
          <ChevronDown size={18} className="shrink-0 text-slate-400" />
        </button>

        {selected && onAddressChange && (
          <div className="flex items-center gap-2 border-t border-dashed border-slate-200 px-3.5 py-2">
            <Building2 size={14} className="shrink-0 text-slate-400" />
            <input
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder={addressPlaceholder}
              className="w-full border-0 bg-transparent p-0 text-[13px] text-navy-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {rect && (
        <SearchPanel
          anchorRect={rect}
          branches={branches}
          value={value}
          tone={tone}
          onPick={(code) => { onChange(code); setRect(null) }}
          onClose={() => setRect(null)}
        />
      )}
    </div>
  )
}
