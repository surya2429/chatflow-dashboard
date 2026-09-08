import { useState, useEffect, useRef } from 'react'
import {
  X, ChevronDown, Users, Plus, Upload, FileUp, Download, Check, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import { NativeSelect } from '../Select'

/**
 * Channel-agnostic contact-list building blocks shared between the WhatsApp
 * contacts CRM (src/pages/Contacts.jsx) and the Website Chat contacts CRM
 * (src/pages/WebChatContacts.jsx). Nothing here references WhatsApp-only
 * concepts (message templates, calling, CTWA ad sources, opt-in/opt-out
 * messaging consent) — those stay local to Contacts.jsx.
 */

/* ─── formatting helpers ─────────────────────────────────────── */
export const avBg  = () => ({ bg: '#EEF4FF', color: '#2563EB' })
export const inits = n => (n||'').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2)
export const fmtD  = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'
export const fmtR  = d => {
  if (!d) return '—'
  const v = Math.floor((Date.now()-new Date(d))/86400000)
  return v===0?'Today':v===1?'Yesterday':v<7?`${v}d ago`:fmtD(d)
}
export const inMo = d => {
  if (!d) return false
  const n=new Date(), t=new Date(d)
  return t.getMonth()===n.getMonth() && t.getFullYear()===n.getFullYear()
}

/* ─── tag color palette ──────────────────────────────────────── */
export const TAG_C = {
  vip:['#fef9c3','#854d0e'], customer:['#dcfce7','#166534'], lead:['#dbeafe','#1e40af'],
  prospect:['#ede9fe','#5b21b6'], refund:['#fee2e2','#991b1b'], appointment:['#e0f2fe','#075985'],
  urgent:['#fff1f2','#9f1239'], 'follow-up':['#faf5ff','#6b21a8'], payment:['#d1fae5','#065f46'],
  partner:['#fdf4ff','#7e22ce'], support:['#e0f2fe','#075985'], satisfied:['#dcfce7','#166534'],
}
export const tSt = t => { const [bg,c]=TAG_C[t]||['#f1f5f9','#64748b']; return {background:bg,color:c} }

/* ─── date filter options + predicate ───────────────────────── */
export const DATE_OPTS = [
  { id:'any',       label:'Any time'      },
  { id:'today',     label:'Today'         },
  { id:'yesterday', label:'Yesterday'     },
  { id:'week',      label:'Last 7 days'   },
  { id:'month',     label:'Last 30 days'  },
  { id:'thismonth', label:'This month'    },
  { id:'lastmonth', label:'Last month'    },
]
export const SORT_OPTS = [
  { id:'recent',    label:'Most recent'        },
  { id:'name-asc',  label:'Name A → Z'         },
  { id:'name-desc', label:'Name Z → A'         },
  { id:'convos',    label:'Most conversations' },
]

export function datePass(c, dateFil) {
  if (dateFil === 'any') return true
  const d = new Date(c.last), now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
  if (dateFil === 'today')     return d >= today
  if (dateFil === 'yesterday') return d >= yesterday && d < today
  if (dateFil === 'week')      { const t = new Date(today); t.setDate(t.getDate()-7); return d >= t }
  if (dateFil === 'month')     { const t = new Date(today); t.setDate(t.getDate()-30); return d >= t }
  if (dateFil === 'thismonth') return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
  if (dateFil === 'lastmonth') {
    const lm = new Date(now.getFullYear(), now.getMonth()-1, 1)
    const em = new Date(now.getFullYear(), now.getMonth(), 1)
    return d >= lm && d < em
  }
  return true
}

/* ─── FilterChip / DropOpt ───────────────────────────────────── */
export function FilterChip({ label, active, onClear, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p=>!p)}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-all whitespace-nowrap',
          active
            ? 'bg-primary-50 text-primary border-primary/30'
            : 'bg-white text-slate-500 border-surface-border hover:bg-surface-hover'
        )}>
        <span className="max-w-[80px] truncate">{label}</span>
        {active
          ? <button onMouseDown={e=>{e.stopPropagation();onClear()}} className="ml-0.5 hover:text-primary/60"><X size={8}/></button>
          : <ChevronDown size={8} className={clsx('transition-transform duration-150', open && 'rotate-180')}/>
        }
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-surface-border rounded-xl shadow-modal z-40 py-0.5 min-w-[160px] max-h-[280px] overflow-y-auto">
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

export function DropOpt({ label, active, icon: Icon, count, onClick }) {
  return (
    <button onClick={onClick}
      className={clsx('w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors',
        active ? 'bg-primary-50 text-primary font-semibold' : 'text-slate-600 hover:bg-surface-hover')}>
      {Icon && (typeof Icon === 'function' ? <Icon/> : <Icon size={11} className="flex-shrink-0 opacity-70"/>)}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && <span className={clsx('text-[10px] font-bold', active ? 'text-primary' : 'text-slate-400')}>{count}</span>}
    </button>
  )
}

/* ─── Create group modal ─────────────────────────────────────── */
export const GROUP_COLORS = ['#8B5CF6','#f59e0b','#10b981','#3b82f6','#f43f5e','#64748b']

export function CreateGroupModal({ onClose, onSave, idPrefix = 'grp' }) {
  const [name,  setName]  = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])
  const [desc,  setDesc]  = useState('')
  const [err,   setErr]   = useState('')
  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 placeholder-slate-300 transition-all'

  function save() {
    if (!name.trim()) { setErr('Group name is required'); return }
    onSave({ id: idPrefix + Date.now(), name: name.trim(), color, desc: desc.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-modal flex flex-col overflow-hidden border border-surface-border">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'#EEF4FF'}}>
            <Users size={13} style={{color:'#2563EB'}}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">Create Group</p>
            <p className="text-[10px] text-slate-400">Organise contacts into a named group</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
            <X size={14}/>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Group Name <span className="text-red-400">*</span></label>
            <input autoFocus className={fi} placeholder="e.g. Premium Members" value={name} onChange={e=>setName(e.target.value)}/>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{background:c, borderColor: color===c ? '#1e40af' : 'transparent', outline: color===c ? '2px solid #93c5fd' : 'none'}}/>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description <span className="text-slate-300">(optional)</span></label>
            <input className={fi} placeholder="Short description…" value={desc} onChange={e=>setDesc(e.target.value)}/>
          </div>
          {err && (
            <p className="text-[11px] text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <X size={11}/>{err}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={save}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={11}/>Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Generic CSV parsing ────────────────────────────────────── */
export function parseContactsCSV(text, { idPrefix = 'imp' } = {}) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return []
  function parseLine(line) {
    const fields = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    fields.push(cur.trim())
    return fields
  }
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g,''))
  const map = h => {
    if (['name','full name','full_name'].includes(h)) return 'name'
    if (['phone','mobile','phone number'].includes(h)) return 'phone'
    if (['email'].includes(h)) return 'email'
    if (['company','organisation','organization','business'].includes(h)) return 'company'
    if (['city','location'].includes(h)) return 'city'
    if (['language','lang'].includes(h)) return 'language'
    if (['tags','tag'].includes(h)) return 'tags'
    if (['agent','assigned to','assigned_to'].includes(h)) return 'agent'
    if (['notes','note'].includes(h)) return 'notes'
    if (['source'].includes(h)) return 'source'
    return null
  }
  const today = new Date().toISOString().slice(0,10)
  return lines.slice(1).filter(l=>l.trim()).map((line, i) => {
    const vals = parseLine(line)
    const row = {}
    const customAttrs = {}
    headers.forEach((h, idx) => {
      const key = map(h)
      const val = (vals[idx]||'').replace(/^"|"$/g,'').trim()
      if (key) row[key] = val
      else if (h && val) customAttrs[h] = val
    })
    if (!row.name && !row.phone && !row.email) return null
    return {
      id: `${idPrefix}_${Date.now()}_${i}`,
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      company: row.company || '',
      city: row.city || '',
      language: row.language || '',
      source: row.source || 'Import',
      tags: row.tags ? row.tags.split(';').map(t=>t.trim()).filter(Boolean) : [],
      agent: row.agent || null,
      notes: row.notes || '',
      starred: false,
      status: 'active',
      convos: 0,
      created: today,
      last: today,
      score: 50,
      aiSummary: '',
      customAttrs: Object.keys(customAttrs).length ? customAttrs : {},
      groupIds: [],
      log: [{t:'created', text:'Imported via CSV', date: today}],
    }
  }).filter(Boolean)
}

/* ─── Generic CSV import modal (no WhatsApp-template purpose picker) ──
   Upload → Preview → Done. Used as-is by Website Chat; WhatsApp keeps its
   own richer ImportModal (with the WA-template-sheet purpose flow) local
   to Contacts.jsx since that path is WhatsApp-specific. ── */
export function GeneralImportModal({ onClose, onImport, groups = [], idPrefix = 'imp', sampleRows }) {
  const [step, setStep] = useState('upload')   // upload | preview | done
  const [parsed, setParsed] = useState([])
  const [drag, setDrag] = useState(false)
  const [assignGroup, setAssignGroup] = useState('')
  const fileRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const contacts = parseContactsCSV(e.target.result, { idPrefix })
      setParsed(contacts)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  function doImport() {
    const toImport = parsed.map(c => ({
      ...c,
      groupIds: assignGroup ? [...(c.groupIds||[]), assignGroup].filter((v,i,a)=>a.indexOf(v)===i) : (c.groupIds||[]),
    }))
    onImport(toImport)
    setStep('done')
    setTimeout(onClose, 1800)
  }

  function downloadSample() {
    const csv = [
      'Name,Phone,Email,Company,City,Language,Tags,Agent,Source,Notes',
      ...(sampleRows || [
        'Sarah Wilson,+15125550142,sarah.wilson@gmail.com,,Austin,English,vip;customer,Priya Das,Direct,Repeat customer',
        'James Carter,,james.carter@outlook.com,Carter & Co,San Francisco,English,prospect,,Referral,On trial',
      ]),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'contacts_sample.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const hasCustomAttrs = parsed.some(c => Object.keys(c.customAttrs||{}).length > 0)

  const TITLES = { upload: 'Upload a CSV file', preview: `Preview — ${parsed.length} contacts found`, done: 'Import complete' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-modal overflow-hidden border border-surface-border flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-border">
          <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <FileUp size={14} className="text-violet-600"/>
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-slate-900">Import Contacts</p>
            <p className="text-[11px] text-slate-400">{TITLES[step]}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step==='upload' && (
            <div className="p-5 space-y-4">
              <div
                onDragOver={e=>{e.preventDefault();setDrag(true)}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0])}}
                onClick={()=>fileRef.current?.click()}
                className={clsx('border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors',
                  drag?'border-primary bg-primary-50':'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                <Upload size={28} className={clsx('mb-3', drag?'text-primary':'text-slate-300')}/>
                <p className="text-[13px] font-semibold text-slate-600">Drop CSV file here</p>
                <p className="text-[11px] text-slate-400 mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>
              </div>
              <div className="bg-slate-50 rounded-xl p-3.5 border border-surface-border">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Name','Phone','Email','Company','City','Language','Tags (;-sep)','Agent','Source','Notes'].map(col=>(
                    <span key={col} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-mono text-slate-600">{col}</span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Name, Phone or Email is required. All other fields are optional.</p>
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <span className="font-semibold text-violet-600">+</span> Any other column name → stored as a <span className="font-semibold">Custom Attribute</span>
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <button onClick={downloadSample}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                    <Download size={11}/> Download sample CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {step==='preview' && (
            <div className="p-4">
              {parsed.length === 0
                ? <div className="text-center py-10">
                    <p className="text-sm text-slate-500 mb-1">No valid contacts found</p>
                    <p className="text-[12px] text-slate-400">Make sure your CSV has a Name, Phone or Email column.</p>
                  </div>
                : <>
                    <p className="text-[11px] text-slate-500 mb-2">Showing first {Math.min(10, parsed.length)} of {parsed.length} contacts:</p>
                    <div className="overflow-x-auto rounded-xl border border-surface-border">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 border-b border-surface-border">
                          <tr>
                            {['Name','Email/Phone','Company','Tags', ...(hasCustomAttrs ? ['Custom Attrs'] : [])].map(h=>(
                              <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {parsed.slice(0,10).map((c, i)=>(
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{c.name||'—'}</td>
                              <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate">{c.email || c.phone || '—'}</td>
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{c.company||'—'}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-0.5">
                                  {c.tags.slice(0,2).map(t=>(
                                    <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize" style={tSt(t)}>{t}</span>
                                  ))}
                                </div>
                              </td>
                              {hasCustomAttrs && (
                                <td className="px-3 py-2 text-slate-500 text-[10px] font-mono">
                                  {Object.keys(c.customAttrs||{}).join(', ') || '—'}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
              }
            </div>
          )}

          {step==='done' && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Check size={28} className="text-emerald-500"/>
              </div>
              <p className="text-[15px] font-bold text-slate-800 mb-1">Import Successful!</p>
              <p className="text-[12px] text-slate-500">{parsed.length} contacts processed and added to your list.</p>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <div className="border-t border-surface-border">
            {step==='preview' && parsed.length > 0 && groups.length > 0 && (
              <div className="px-4 pt-3 pb-0">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">Assign to Group</label>
                  <NativeSelect value={assignGroup} onChange={e=>setAssignGroup(e.target.value)} sm className="flex-1">
                    <option value="">— None —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </NativeSelect>
                </div>
              </div>
            )}
            <div className="flex gap-2 px-4 py-3">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center text-xs">Cancel</button>
              {step==='preview' && parsed.length > 0 && (
                <button onClick={doImport}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <FileUp size={12}/>Import {parsed.length} contacts
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Generic CSV export ─────────────────────────────────────── */
export function exportContactsCSV(contacts, { filename = 'contacts', extraColumns = [] } = {}) {
  const headers = ['Name','Phone','Email','Company','City','Language','Source','Status','Tags','Agent','Created','Last Contact','Conversations','Notes', ...extraColumns.map(c=>c.label)]
  const rows = contacts.map(c => [
    c.name, c.phone||'', c.email||'', c.company||'', c.city||'', c.language||'',
    c.source, c.status, (c.tags||[]).join(';'), c.agent||'',
    c.created||'', c.last||'', c.convos||0, (c.notes||'').replace(/\n/g,' '),
    ...extraColumns.map(col => col.get(c)),
  ])
  const escape = v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0,10)
  a.href = url
  a.download = `${filename}_${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
