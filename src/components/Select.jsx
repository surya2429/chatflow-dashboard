import { useState, useRef, useEffect, Children } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'
import clsx from 'clsx'

/**
 * Modern custom Select component with built-in search
 *
 * Props:
 *   value       — current selected value
 *   onChange    — fn(value) called on selection
 *   options     — [{ value, label, icon?, sub? }]  OR  [{ label, options: [...] }] for groups
 *   placeholder — shown when value is empty / undefined
 *   className   — extra classes on the trigger button
 *   disabled    — disable the select
 *   size        — 'sm' | 'md' (default 'md')
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className = '',
  disabled = false,
  size = 'md',
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 })
  const btnRef    = useRef(null)
  const dropRef   = useRef(null)
  const searchRef = useRef(null)

  const flatOptions = options.flatMap(o => o.options ? o.options : [o])
  const selected    = flatOptions.find(o => o.value === value)

  const filteredOptions = query.trim()
    ? options.map(o =>
        o.options
          ? { ...o, options: o.options.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase())) }
          : o
      ).filter(o => o.options ? o.options.length > 0 : o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function openDrop() {
    if (disabled) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    setQuery('')
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 30)
  }

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!btnRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const sm = size === 'sm'

  const triggerCls = clsx(
    'flex items-center justify-between gap-2 w-full rounded-lg border transition-all duration-150 text-left',
    sm ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
    open
      ? 'border-primary ring-2 ring-primary/10 bg-white text-slate-800'
      : 'border-surface-border bg-white text-slate-700 hover:border-primary/40',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  )

  function renderOptions(opts) {
    return opts.map((opt, i) => {
      const isSelected = opt.value === value
      return (
        <button
          key={i}
          onClick={() => { onChange(opt.value); setOpen(false); setQuery('') }}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
            sm ? 'text-[11px]' : 'text-xs',
            isSelected
              ? 'bg-primary-50 text-primary font-semibold'
              : 'text-slate-700 hover:bg-surface-hover'
          )}
        >
          {opt.icon && <opt.icon size={12} className="flex-shrink-0 text-slate-400" />}
          <span className="flex-1 truncate">{opt.label}</span>
          {opt.sub && <span className="text-[10px] text-slate-400">{opt.sub}</span>}
          {isSelected && <Check size={11} className="flex-shrink-0 text-primary" />}
        </button>
      )
    })
  }

  const hasResults = filteredOptions.some(o => o.options ? o.options.length > 0 : true)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={open ? () => setOpen(false) : openDrop}
        className={triggerCls}
      >
        <span className={clsx('truncate', !selected && 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={12}
          className={clsx('flex-shrink-0 text-slate-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className="bg-white rounded-xl border border-surface-border shadow-modal overflow-hidden flex flex-col"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: Math.max(pos.width, 180),
            zIndex: 99999,
            maxHeight: 300,
          }}
        >
          {/* Search */}
          <div className="p-2 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search size={11} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 text-[11px] bg-transparent outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto py-1">
            {!hasResults ? (
              <p className="text-[11px] text-slate-400 text-center py-3">No results</p>
            ) : filteredOptions.some(o => o.options) ? (
              filteredOptions.map((group, gi) => group.options?.length > 0 && (
                <div key={gi}>
                  <p className="px-3 pt-2.5 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    {group.label}
                  </p>
                  {renderOptions(group.options)}
                </div>
              ))
            ) : (
              renderOptions(filteredOptions)
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/** Recursively flatten React children to a plain string. */
function childText(c) {
  if (c == null) return ''
  if (typeof c === 'string' || typeof c === 'number') return String(c)
  if (Array.isArray(c)) return c.map(childText).join('')
  return ''
}

/** Parse <option> / <optgroup> children into flat [{value, label, group?}] */
function parseOptions(children) {
  const out = []
  Children.forEach(children, child => {
    if (!child) return
    if (child.type === 'option') {
      out.push({ value: child.props.value ?? '', label: childText(child.props.children) })
    } else if (child.type === 'optgroup') {
      const grp = child.props.label || ''
      Children.forEach(child.props.children, gc => {
        if (!gc || gc.type !== 'option') return
        out.push({ value: gc.props.value ?? '', label: childText(gc.props.children), group: grp })
      })
    }
  })
  return out
}

/**
 * NativeSelect — searchable custom dropdown that accepts <option> / <optgroup> children
 * Drop-in replacement for native <select>; onChange receives a synthetic { target: { value } } event.
 */
export function NativeSelect({ value, onChange = () => {}, children, className = '', sm = false, disabled = false }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 })
  const btnRef    = useRef(null)
  const dropRef   = useRef(null)
  const searchRef = useRef(null)

  const options = parseOptions(children)

  const selected = options.find(o => String(o.value) === String(value))
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function openDrop() {
    if (disabled) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    setQuery('')
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 30)
  }

  function pick(v) {
    onChange({ target: { value: v } })
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!btnRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={open ? () => setOpen(false) : openDrop}
        className={clsx(
          'flex items-center justify-between gap-2 w-full rounded-lg border transition-all text-left',
          sm ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
          open
            ? 'border-primary ring-2 ring-primary/10 bg-white text-slate-800'
            : 'border-surface-border bg-white text-slate-700 hover:border-primary/40',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <span className={clsx('truncate flex-1 min-w-0', !selected && 'text-slate-400')}>
          {selected ? selected.label : '—'}
        </span>
        <ChevronDown
          size={12}
          className={clsx('flex-shrink-0 text-slate-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className="bg-white rounded-xl border border-surface-border shadow-modal overflow-hidden flex flex-col"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: Math.max(pos.width, 180),
            zIndex: 99999,
            maxHeight: 300,
          }}
        >
          {/* Search */}
          <div className="p-2 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search size={11} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 text-[11px] bg-transparent outline-none text-slate-700 placeholder:text-slate-400 min-w-0"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-3">No results</p>
            ) : (() => {
              const rows = []
              let lastGroup = null
              filtered.forEach(opt => {
                if (opt.group && opt.group !== lastGroup) {
                  lastGroup = opt.group
                  rows.push(
                    <p key={`grp-${opt.group}`} className="px-3 pt-2 pb-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                      {opt.group}
                    </p>
                  )
                }
                rows.push(
                  <button
                    key={rows.length}
                    onClick={() => pick(opt.value)}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                      sm ? 'text-[11px]' : 'text-xs',
                      String(opt.value) === String(value)
                        ? 'bg-primary-50 text-primary font-semibold'
                        : 'text-slate-700 hover:bg-surface-hover'
                    )}
                  >
                    <span className="flex-1 truncate">{opt.label}</span>
                    {String(opt.value) === String(value) && (
                      <Check size={11} className="flex-shrink-0 text-primary" />
                    )}
                  </button>
                )
              })
              return rows
            })()}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
