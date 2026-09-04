import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import clsx from 'clsx'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function parseYMD(v) {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatDisplay(v) {
  const d = parseYMD(v)
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DatePicker({ value, onChange, min, className = '', textSize = 'text-[11px]' }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const sel   = parseYMD(value)
  const minDt = parseYMD(min) || today

  const [open,      setOpen]      = useState(false)
  const [viewYear,  setViewYear]  = useState((sel || today).getFullYear())
  const [viewMonth, setViewMonth] = useState((sel || today).getMonth())
  const ref = useRef()

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function buildGrid() {
    const first = new Date(viewYear, viewMonth, 1)
    const last  = new Date(viewYear, viewMonth + 1, 0)
    const cells = []
    for (let i = 0; i < first.getDay(); i++) cells.push(null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(viewYear, viewMonth, d))
    return cells
  }

  function selectDay(d) {
    if (!d || d < minDt) return
    onChange(toYMD(d))
    setOpen(false)
  }

  const cells = buildGrid()

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center gap-2 border rounded-xl px-3 py-2 outline-none transition-all text-left',
          textSize,
          open ? 'border-primary ring-1 ring-primary/10 shadow-sm' : 'border-slate-200 hover:border-slate-300',
          value ? 'text-slate-800' : 'text-slate-400'
        )}
      >
        <Calendar size={12} className={clsx('flex-shrink-0', open ? 'text-primary' : 'text-slate-400')}/>
        <span className="flex-1">{value ? formatDisplay(value) : 'Pick a date'}</span>
        <ChevronRight size={10} className={clsx('transition-transform text-slate-300', open && 'rotate-90')}/>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[200] p-3.5 w-64 animate-fade-in">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronLeft size={14}/>
            </button>
            <span className="text-[12px] font-bold text-slate-800 tracking-tight">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <ChevronRight size={14}/>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[9px] font-bold text-slate-400 py-0.5">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i}/>
              const isSel      = sel && d.toDateString() === sel.toDateString()
              const isToday    = d.toDateString() === today.toDateString()
              const isDisabled = d < minDt
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(d)}
                  disabled={isDisabled}
                  className={clsx(
                    'h-7 w-full rounded-lg text-[11px] font-medium transition-colors',
                    isSel      ? 'bg-primary text-white shadow-sm' :
                    isToday    ? 'border border-primary text-primary font-bold' :
                    isDisabled ? 'text-slate-300 cursor-not-allowed' :
                                 'text-slate-700 hover:bg-primary-50 hover:text-primary'
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          {!isNaN(minDt) && minDt <= today && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center">
              <button type="button" onClick={() => selectDay(today)}
                className="text-[10px] font-semibold text-primary hover:text-primary-hover transition-colors">
                Today
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
