// PopupShell.jsx — the one popup frame used across the website-chat dashboard, matching the WhatsApp
// flow builder's question edit popup (pages/FlowSetup.jsx): blurred backdrop, rounded white card, a header
// with a tinted icon tile + title + category pill + small meta line, an optional underlined tab bar, a
// scrolling body of soft grey sections, and a footer with Cancel / "Save changes" (and an optional
// destructive action on the left).
//
//   <PopupShell icon={Icon} color="#0066ff" title="Help articles" badge="Widget" meta={<>…</>}
//               onClose={…} footer={<PopupFooter onCancel={…} onSave={…} />}>
//     <PopupSection title="Question text">…</PopupSection>
//   </PopupShell>
import { useEffect } from 'react'
import clsx from 'clsx'
import { X, Save, Trash2 } from 'lucide-react'

const CSS = `
@keyframes wcPopupIn{from{opacity:0;transform:scale(.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
/* Field labels inside a popup read like the WhatsApp editor's: small, grey, upper-case. */
.wc-popup .label{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;display:flex;align-items:center;gap:6px}
`

export default function PopupShell({
  icon: Icon, color = '#0066ff', title, badge, meta, onClose, children, footer,
  tabs, activeTab, onTab,
  width = 640, tall = false,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <style>{CSS}</style>
      <div role="dialog" aria-label={title} className="wc-popup bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: `min(${width}px, calc(100vw - 24px))`, ...(tall ? { height: 'min(92vh, 820px)' } : { maxHeight: '92vh' }), animation: 'wcPopupIn .22s cubic-bezier(.22,1,.36,1)' }}>

        {/* Header */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {Icon && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '15', border: `1.5px solid ${color}25` }}>
                  <Icon size={14} style={{ color }}/>
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-bold text-slate-900 leading-tight">{title}</p>
                  {badge && <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5 leading-none flex-shrink-0" style={{ color, background: color + '15' }}>{badge}</span>}
                </div>
                {meta && <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400">{meta}</div>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
              <X size={14}/>
            </button>
          </div>
        </div>

        {/* Tabs (optional) */}
        {tabs?.length > 0 && (
          <div className="flex border-b border-slate-100 bg-white px-3 flex-shrink-0 gap-0.5 overflow-x-auto">
            {tabs.map(t => {
              const TIcon = t.icon
              const active = activeTab === t.id
              return (
                <button key={t.id} onClick={() => onTab?.(t.id)}
                  className={clsx('flex items-center gap-1 px-2.5 py-2 text-[11px] font-semibold transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                    active ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200')}>
                  {TIcon && <TIcon size={11}/>}{t.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 space-y-4">{children}</div>
        </div>

        {footer}
      </div>
    </div>
  )
}

/* A soft grey block with a small upper-case heading — the WhatsApp editor's section. */
export function PopupSection({ title, hint, children, className }) {
  return (
    <div className={clsx('rounded-xl bg-slate-50 border border-slate-100 p-3.5 space-y-3', className)}>
      {title && <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>}
      {children}
      {hint && <p className="text-[10px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  )
}

export function PopupFooter({ onCancel, onSave, saveLabel = 'Save changes', cancelLabel = 'Cancel', onDelete, disabled, left }) {
  return (
    <div className="px-4 py-2.5 border-t border-slate-100 flex-shrink-0 flex items-center gap-2 bg-white">
      {onDelete && (
        <button type="button" onClick={onDelete} title="Delete" aria-label="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14}/></button>
      )}
      {left}
      <div className="flex-1"/>
      <button type="button" onClick={onCancel} className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-[.97] transition-all">{cancelLabel}</button>
      <button type="button" onClick={onSave} disabled={disabled}
        className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 active:scale-[.97] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
        <Save size={11}/> {saveLabel}
      </button>
    </div>
  )
}
