import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, X, Star, Mail, MapPin, Building2,
  Globe, MessageSquare, CheckCircle2, Shield, UserPlus, Trash2, UserCheck,
  Upload, Download, Users, Clock, Monitor, Eye, Link2, Hash,
  ChevronDown, SlidersHorizontal, Sparkles, Variable, Layers, FolderPlus,
  LayoutList, Table2, CheckSquare, MousePointer2, ArrowLeft,
} from 'lucide-react'
import { useConversations } from '../context/ConversationContext'
import clsx from 'clsx'
import { NativeSelect } from '../components/Select'
import PopupShell, { PopupSection, PopupFooter } from '../components/webchat/PopupShell'
import { WEBCHAT_CONTACTS } from '../constants/mockData'
import {
  avBg, inits, fmtD, fmtR, inMo, tSt, SORT_OPTS, datePass,
  FilterChip, DropOpt, CreateGroupModal, GeneralImportModal, exportContactsCSV,
} from '../components/contacts/SharedContactParts'
import { EditableField, EditablePhoneField } from '../components/inbox/SharedInboxParts'

/* ── constants ──────────────────────────────────────────────── */
const TAGS    = ['vip','customer','lead','prospect','support','urgent','follow-up','satisfied']
const AGENTS  = ['Rahul Mehta','Priya Das','Aryan Kapoor','Sunita Rao']
const LANGS   = ['English','Hindi','Portuguese','German','Arabic','Korean','Japanese','Gujarati','Kannada']
const SOURCES = ['Direct','Referral','Import','Manual']

const INIT_GROUPS = [
  { id: 'wgrp1', name: 'Warm Leads',      color: '#8B5CF6', desc: 'Active prospects worth following up' },
  { id: 'wgrp2', name: 'Free Plan Users', color: '#f59e0b', desc: 'Signed up, not yet converted' },
  { id: 'wgrp3', name: 'VIP Customers',   color: '#10b981', desc: 'Highest-value accounts' },
]

const SEGS = [
  { id:'all',       label:'All contacts',   icon:Users,        fn:()=>true },
  { id:'starred',   label:'Starred',        icon:Star,         fn:c=>c.starred },
  { id:'blocked',   label:'Blocked',        icon:Shield,       fn:c=>c.status==='blocked' },
  { id:'unassigned',label:'Unassigned',     icon:UserCheck,    fn:c=>!c.agent },
  { id:'new',       label:'New This Month', icon:UserPlus,     fn:c=>inMo(c.created) },
]

const LOG_ST = {
  message:  { bg:'#dbeafe', c:'#2563eb' },
  resolved: { bg:'#dcfce7', c:'#16a34a' },
  created:  { bg:'#f1f5f9', c:'#64748b' },
  blocked:  { bg:'#fee2e2', c:'#dc2626' },
}
const SRC = {
  Direct:{bg:'#dcfce7',c:'#15803d'}, Referral:{bg:'#dbeafe',c:'#1d4ed8'},
  Import:{bg:'#f3e8ff',c:'#6d28d9'}, Manual:{bg:'#f0fdf4',c:'#166534'},
}

/* ── contact list row ───────────────────────────────────────── */
function ContactRow({ c, active, onClick, selected, onToggle, manualSelect }) {
  return (
    <div className={clsx(
      'w-full flex items-center gap-1 px-2 py-2 transition-colors border-b border-surface-border/60 group',
      active ? 'bg-primary-50' : 'hover:bg-surface-hover'
    )}>
      <div className="flex-shrink-0 w-3.5 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={!!selected} onChange={() => onToggle(c.id)}
          className={clsx('w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer transition-opacity',
            (selected || manualSelect) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}/>
      </div>
      <button onClick={onClick} className="flex flex-1 items-center gap-2 text-left min-w-0">
        <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-semibold text-[12px] flex-shrink-0"
          style={{background:avBg().bg, color:avBg().color}}>{inits(c.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-[1px]">
            <p className={clsx('text-[12px] font-semibold truncate', active ? 'text-primary' : 'text-slate-800')}>{c.name}</p>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtR(c.last)}</span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-[11px] text-slate-500 truncate flex-1">{c.email || c.phone || '—'}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {c.starred && <Star size={9} className="text-amber-400 fill-amber-400"/>}
              {c.tags[0] && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize" style={tSt(c.tags[0])}>{c.tags[0]}</span>}
            </div>
          </div>
          {c.company && <p className="text-[10px] text-slate-400 truncate mt-[1px]">{c.company}</p>}
        </div>
      </button>
    </div>
  )
}

/* ── contact table view ──────────────────────────────────────── */
function ContactTable({ contacts, selId, onContactClick, selectedIds, onToggle, onToggleAll, onChat }) {
  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id))
  const someSelected = contacts.some(c => selectedIds.has(c.id))
  const cbRef = useRef(null)
  useEffect(() => { if (cbRef.current) cbRef.current.indeterminate = someSelected && !allSelected }, [someSelected, allSelected])
  const TH = 'text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap bg-white select-none'

  if (!contacts.length) return (
    <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
      <Users size={28} className="text-slate-300 mb-3"/>
      <p className="text-[13px] font-semibold text-slate-500 mb-1">No contacts found</p>
      <p className="text-[12px] text-slate-400">Try adjusting your search or filters</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            <th className={clsx(TH, 'w-10')}>
              <input ref={cbRef} type="checkbox" checked={allSelected} onChange={() => onToggleAll(contacts)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
            </th>
            <th className={TH}>Name</th>
            <th className={TH}>Email / Phone</th>
            <th className={TH}>Company</th>
            <th className={TH}>Source</th>
            <th className={TH}>Status</th>
            <th className={TH}>Tags</th>
            <th className={TH}>Last Contact</th>
            <th className={TH}>Agent</th>
            <th className={clsx(TH, 'text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {contacts.map(c => {
            const isSel  = selectedIds.has(c.id)
            const isActive = selId === c.id
            return (
              <tr key={c.id} onClick={() => onContactClick(c.id)}
                className={clsx('cursor-pointer transition-colors group',
                  isActive ? 'bg-primary-50' : isSel ? 'bg-primary-50/40' : 'hover:bg-slate-50/70')}>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => onToggle(c.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{background:avBg().bg, color:avBg().color}}>{inits(c.name)}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className={clsx('text-[11px] font-semibold whitespace-nowrap', isActive ? 'text-primary' : 'text-slate-800')}>{c.name}</p>
                        {c.starred && <Star size={9} className="text-amber-400 fill-amber-400 flex-shrink-0"/>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500 max-w-[160px] truncate">{c.email || c.phone || '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{c.company || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                    style={{background:SRC[c.source]?.bg||'#f1f5f9', color:SRC[c.source]?.c||'#475569'}}>{c.source}</span>
                </td>
                <td className="px-3 py-2.5">
                  {c.status === 'blocked'
                    ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-600"><Shield size={8}/>Blocked</span>
                    : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700"><CheckCircle2 size={8}/>Active</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-0.5">
                    {c.tags.slice(0,2).map(t => <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize whitespace-nowrap" style={tSt(t)}>{t}</span>)}
                    {c.tags.length > 2 && <span className="text-[9px] text-slate-400 self-center">+{c.tags.length-2}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{fmtR(c.last)}</td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500">{c.agent?.split(' ')[0] || '—'}</td>
                <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onChat(c)} title="Open chat"
                      className="p-1.5 rounded-lg hover:bg-primary-50 text-slate-400 hover:text-primary transition-colors">
                      <MessageSquare size={12}/>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── add contact modal ───────────────────────────────────────── */
function AddModal({ onClose, onAdd }) {
  const [f, setF]         = useState({ name:'', email:'', company:'', city:'', language:'', source:'Manual', agent:'' })
  const [cc, setCc]       = useState('+91')
  const [phone, setPhone] = useState('')
  const [err, setErr]     = useState('')
  const [attrs, setAttrs] = useState([])
  const [addingAttr, setAddingAttr] = useState(false)
  const [attrKey, setAttrKey] = useState('')
  const [attrVal, setAttrVal] = useState('')

  const up = k => e => setF(p => ({...p, [k]: e.target.value}))
  const fi = 'w-full text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 placeholder-slate-300 transition-all'
  const lb = 'block text-[10px] font-semibold text-slate-500 mb-1'

  function addAttr() {
    const k = attrKey.trim(), v = attrVal.trim()
    if (!k) return
    setAttrs(p => [...p.filter(a => a.key !== k), {key: k, val: v}])
    setAttrKey(''); setAttrVal(''); setAddingAttr(false)
  }

  function submit() {
    if (!f.name.trim())  { setErr('Name is required'); return }
    if (!f.email.trim() && !phone.trim()) { setErr('Email or phone is required'); return }
    const customAttrs = {}
    attrs.forEach(a => { if (a.key) customAttrs[a.key] = a.val })
    onAdd({
      ...f, phone: phone.trim() ? `${cc} ${phone.trim()}` : '',
      id: String(Date.now()), starred: false, status: 'active', tags: [],
      agent: f.agent || null, convos: 0,
      created: new Date().toISOString().slice(0,10),
      last:    new Date().toISOString().slice(0,10),
      notes: '', score: 50, aiSummary: '', customAttrs,
      log: [{t:'created', text:'Created manually', date: new Date().toISOString().slice(0,10)}]
    })
    onClose()
  }

  return (
    <PopupShell icon={UserPlus} color="#0066ff" title="Add New Contact" badge="Contacts" width={640}
      meta={<span>Fill in the details below to create a contact</span>} onClose={onClose}
      footer={<PopupFooter onCancel={onClose} onSave={submit} saveLabel="Add contact"/>}>
        <>
          <PopupSection title="Basic information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className={lb}>Name <span className="text-red-400">*</span></label>
                <input className={fi} placeholder="Sarah Wilson" value={f.name} onChange={up('name')} autoFocus/>
              </div>
              <div className="sm:col-span-2">
                <label className={lb}>Phone</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-shrink-0">
                    <NativeSelect value={cc} onChange={e=>setCc(e.target.value)} sm>
                      {['+91','+1','+44','+65','+971','+81','+82','+49'].map(code => <option key={code} value={code}>{code}</option>)}
                    </NativeSelect>
                  </div>
                  <input className={fi} placeholder="98765 43210" value={phone} onChange={e=>setPhone(e.target.value)}/>
                </div>
              </div>
              <div>
                <label className={lb}>Email</label>
                <input type="email" className={fi} placeholder="sarah@example.com" value={f.email} onChange={up('email')}/>
              </div>
              <div>
                <label className={lb}>Company</label>
                <input className={fi} placeholder="Acme Corp" value={f.company} onChange={up('company')}/>
              </div>
              <div>
                <label className={lb}>City</label>
                <input className={fi} placeholder="Austin" value={f.city} onChange={up('city')}/>
              </div>
              <div>
                <label className={lb}>Language</label>
                <NativeSelect value={f.language} onChange={up('language')} sm>
                  <option value="">Select…</option>
                  {LANGS.map(l => <option key={l}>{l}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className={lb}>Source</label>
                <NativeSelect value={f.source} onChange={up('source')} sm>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </NativeSelect>
              </div>
              <div>
                <label className={lb}>Assign To</label>
                <NativeSelect value={f.agent} onChange={up('agent')} sm>
                  <option value="">Unassigned</option>
                  {AGENTS.map(a => <option key={a}>{a}</option>)}
                </NativeSelect>
              </div>
            </div>
          </PopupSection>

          <PopupSection>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Variable size={11} className="text-slate-400"/>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Attributes</p>
              </div>
              <button onClick={() => setAddingAttr(p => !p)} className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                <Plus size={11}/>Add
              </button>
            </div>
            <div className="space-y-1.5">
              {attrs.map((a, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-surface-border">
                  <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[70px] truncate">{a.key}</span>
                  <span className="text-[11px] text-slate-500 mx-1">→</span>
                  <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">{a.val || '—'}</span>
                  <button onClick={() => setAttrs(p => p.filter((_,j) => j !== i))}
                    className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={11}/></button>
                </div>
              ))}
              {!attrs.length && !addingAttr && <p className="text-[11px] text-slate-300 italic px-1">No custom attributes yet</p>}
            </div>
            {addingAttr && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input autoFocus value={attrKey} onChange={e => setAttrKey(e.target.value)} placeholder="Variable name" className={fi}/>
                  <input value={attrVal} onChange={e => setAttrVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') addAttr(); if(e.key==='Escape') setAddingAttr(false) }}
                    placeholder="Value" className={fi}/>
                </div>
                <div className="flex gap-2">
                  <button onClick={addAttr} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">Add Attribute</button>
                  <button onClick={() => { setAddingAttr(false); setAttrKey(''); setAttrVal('') }}
                    className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-[11px] hover:bg-surface-hover">Cancel</button>
                </div>
              </div>
            )}
          </PopupSection>

          {err && (
            <p className="text-[11px] text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-1.5"><X size={11}/>{err}</p>
          )}
        </>
    </PopupShell>
  )
}

/* ── right contact panel ─────────────────────────────────────── */
function ContactPanel({ c, onClose, onUpdate, onDelete, onChat, groups = [] }) {
  const [tab,       setTab]      = useState('info')
  const [addTag,    setAddTag]   = useState(false)
  const [newTag,    setNewTag]   = useState('')
  const [menuOpen,  setMenuOpen] = useState(false)
  const [noteText,  setNoteText] = useState(c.notes||'')
  const [noteDirty, setNoteDirty]= useState(false)
  const [newAttrKey, setNewAttrKey] = useState('')
  const [newAttrVal, setNewAttrVal] = useState('')
  const [addingAttr, setAddingAttr] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => { setTab('info'); setAddTag(false); setNoteText(c.notes||''); setNoteDirty(false) }, [c.id])
  useEffect(() => {
    if (!menuOpen) return
    const h = e => { if(!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const hasNotes = (c.notes||'').trim().length > 0
  const hasVisitContext = c.page || c.browser || c.referrer

  function doAddTag() {
    const t = newTag.trim().toLowerCase()
    if (t && !c.tags.includes(t)) onUpdate(c.id, {tags:[...c.tags, t]})
    setNewTag(''); setAddTag(false)
  }
  function saveNote() { onUpdate(c.id, {notes: noteText}); setNoteDirty(false) }
  function addCustomAttr() {
    const k = newAttrKey.trim(), v = newAttrVal.trim()
    if (!k) return
    onUpdate(c.id, { customAttrs: { ...(c.customAttrs||{}), [k]: v } })
    setNewAttrKey(''); setNewAttrVal(''); setAddingAttr(false)
  }
  function removeCustomAttr(key) {
    const next = { ...(c.customAttrs||{}) }; delete next[key]
    onUpdate(c.id, { customAttrs: next })
  }

  const TABS = [ { key:'info', label:'Info' }, { key:'activity', label:'Activity' }, { key:'notes', label:'Notes' } ]

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden border-l border-surface-border min-w-0">

      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-border bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] flex-shrink-0"
            style={{background:avBg().bg, color:avBg().color}}>{inits(c.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{c.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{c.email || c.phone || 'No contact info yet'}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(p=>!p)} title="More actions" className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors">
                <ChevronDown size={14} className={clsx('transition-transform', menuOpen && 'rotate-180')}/>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-surface-border rounded-xl shadow-modal z-30 py-1 overflow-hidden"
                  onClick={() => setMenuOpen(false)}>
                  <button onClick={() => onUpdate(c.id,{starred:!c.starred})}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                    <Star size={12} className={c.starred?'text-amber-400 fill-amber-400':''}/>{c.starred?'Remove star':'Star contact'}
                  </button>
                  <button onClick={() => onUpdate(c.id,{status:c.status==='blocked'?'active':'blocked'})}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-600 hover:bg-surface-hover">
                    <Shield size={12}/>{c.status==='blocked'?'Unblock':'Block contact'}
                  </button>
                  <div className="h-px bg-surface-border mx-2 my-1"/>
                  <button onClick={() => onDelete(c.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50">
                    <Trash2 size={12}/>Delete contact
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={14}/></button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1 flex-wrap">
            {c.status==='blocked'
              ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100"><Shield size={8}/>Blocked</span>
              : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 size={8}/>Active</span>
            }
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary border border-primary/10">{c.source}</span>
            {c.starred && <Star size={10} className="text-amber-400 fill-amber-400 ml-0.5"/>}
          </div>
          <button onClick={() => onChat(c)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
            <MessageSquare size={11}/>Open Chat
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-1 mx-4 mt-3 mb-1.5 rounded-xl flex-shrink-0 w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx('relative flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all',
              tab===key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {label}
            {key==='notes' && hasNotes && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"/>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* INFO TAB */}
        {tab==='info' && (
          <div className="p-4 space-y-3">

            {/* AI intelligence */}
            <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100/60">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-violet-500"/>
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">AI Contact Intelligence</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-slate-500 font-medium">Score</p>
                  <div className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold',
                    c.score >= 80 ? 'bg-emerald-100 text-emerald-700' : c.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600')}>
                    {c.score}/100
                  </div>
                </div>
              </div>
              <div className="px-4 pt-2 pb-1">
                <div className="w-full h-1 bg-violet-100 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all', c.score >= 80 ? 'bg-emerald-400' : c.score >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{width: `${c.score}%`}}/>
                </div>
              </div>
              <p className="px-4 py-2 text-[11px] text-slate-600 leading-relaxed">{c.aiSummary || 'No AI summary available yet.'}</p>
            </div>

            {/* Editable contact info */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Information</p>
              </div>
              <div>
                <EditablePhoneField label="Phone" value={c.phone} onSave={v => onUpdate(c.id, { phone: v })}/>
                <EditableField icon={Mail}      label="Email"    value={c.email}    onSave={v => onUpdate(c.id, { email: v })} type="email"/>
                <EditableField icon={Building2} label="Company"  value={c.company}  onSave={v => onUpdate(c.id, { company: v })}/>
                <EditableField icon={MapPin}    label="City"     value={c.city}     onSave={v => onUpdate(c.id, { city: v })}/>
                <EditableField icon={Globe}     label="Language" value={c.language} onSave={v => onUpdate(c.id, { language: v })}/>
              </div>
            </div>

            {/* Visit context (read-only) */}
            {hasVisitContext && (
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visit Context</p>
                </div>
                <div className="divide-y divide-surface-border/60">
                  {[
                    ...(c.visitorId ? [{Icon:Hash, label:'Visitor ID', val:c.visitorId, mono:true,
                      title:"Persisted client-side (localStorage) by the chat widget — this is what \"Open Chat\" matches to find this contact's conversation."}] : []),
                    {Icon:Link2,    label:'First page', val:c.page || '—'},
                    {Icon:Monitor,  label:'Browser',    val:c.browser ? `${c.browser}${c.os ? ' on '+c.os : ''}` : '—'},
                    {Icon:MapPin,   label:'Location',   val:c.location || '—'},
                    {Icon:Globe,    label:'Referrer',   val:c.referrer || '—'},
                    {Icon:Eye,      label:'Visits',     val: c.visits != null ? `${c.visits} visit${c.visits===1?'':'s'}` : '—'},
                  ].map(({Icon,label,val,mono,title}) => (
                    <div key={label} className="flex items-start gap-2.5 px-4 py-2.5" title={title}>
                      <Icon size={12} className="text-slate-400 flex-shrink-0 mt-0.5"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 leading-none mb-0.5">{label}</p>
                        <p className={clsx('text-[11px] text-slate-700 font-medium break-all', mono && 'font-mono')}>{val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details + Agent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</p>
                </div>
                <div className="divide-y divide-surface-border/60">
                  {[['Added on', fmtD(c.created)], ['Last contact', fmtD(c.last)], ['Conversations', String(c.convos)], ['Source', c.source]].map(([l,v]) => (
                    <div key={l} className="flex items-center justify-between px-4 py-2">
                      <span className="text-[10px] text-slate-400">{l}</span>
                      <span className="text-[11px] font-semibold text-slate-700">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Agent</p>
                </div>
                <div className="p-3">
                  <NativeSelect value={c.agent||''} onChange={e => onUpdate(c.id,{agent:e.target.value||null})} sm>
                    <option value="">Unassigned</option>
                    {AGENTS.map(a => <option key={a}>{a}</option>)}
                  </NativeSelect>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags</p>
                <button onClick={() => setAddTag(p=>!p)} className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                  <Plus size={11}/>Add tag
                </button>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 min-h-[28px]">
                  {c.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={tSt(t)}>
                      {t}
                      <button onClick={() => onUpdate(c.id,{tags:c.tags.filter(x=>x!==t)})} className="opacity-50 hover:opacity-100 ml-0.5"><X size={9}/></button>
                    </span>
                  ))}
                  {!c.tags.length && !addTag && <span className="text-[11px] text-slate-300 italic">No tags assigned</span>}
                </div>
                {addTag && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input autoFocus value={newTag} onChange={e=>setNewTag(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')doAddTag();if(e.key==='Escape')setAddTag(false)}}
                        placeholder="Type a tag name…"
                        className="flex-1 text-[11px] border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"/>
                      <button onClick={doAddTag} className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold">Add</button>
                      <button onClick={()=>setAddTag(false)} className="px-2 py-1.5 rounded-lg text-slate-400 hover:bg-surface-hover"><X size={13}/></button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {TAGS.filter(t=>!c.tags.includes(t)).map(t=>(
                        <button key={t} onClick={() => {onUpdate(c.id,{tags:[...c.tags,t]});setAddTag(false)}}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize hover:opacity-80 transition-opacity" style={tSt(t)}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Groups */}
            {groups.length > 0 && (
              <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Groups</p>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(c.groupIds||[]).map(gid => {
                      const grp = groups.find(g=>g.id===gid)
                      if (!grp) return null
                      return (
                        <span key={gid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{background: grp.color + '20', color: grp.color}}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:grp.color}}/>
                          {grp.name}
                          <button onClick={() => onUpdate(c.id, {groupIds:(c.groupIds||[]).filter(x=>x!==gid)})} className="opacity-50 hover:opacity-100 ml-0.5"><X size={9}/></button>
                        </span>
                      )
                    })}
                    {!(c.groupIds||[]).length && <span className="text-[11px] text-slate-300 italic">Not in any group</span>}
                  </div>
                  {groups.filter(g=>!(c.groupIds||[]).includes(g.id)).length > 0 && (
                    <NativeSelect value="" onChange={e => { if (!e.target.value) return; onUpdate(c.id, { groupIds: [...(c.groupIds||[]), e.target.value] }) }} sm>
                      <option value="">+ Add to group…</option>
                      {groups.filter(g=>!(c.groupIds||[]).includes(g.id)).map(g=>(<option key={g.id} value={g.id}>{g.name}</option>))}
                    </NativeSelect>
                  )}
                </div>
              </div>
            )}

            {/* Custom attributes */}
            <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-slate-50/50">
                <div className="flex items-center gap-1.5">
                  <Variable size={11} className="text-slate-400"/>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Attributes</p>
                </div>
                <button onClick={() => setAddingAttr(p=>!p)} className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                  <Plus size={11}/>Add
                </button>
              </div>
              <div className="p-3 space-y-2">
                {Object.keys(c.customAttrs||{}).length === 0 && !addingAttr && <p className="text-[11px] text-slate-300 italic px-1">No custom attributes yet.</p>}
                {Object.entries(c.customAttrs||{}).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-surface-border">
                    <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[70px] truncate">{k}</span>
                    <span className="text-[11px] text-slate-500 mx-1">→</span>
                    <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">{v}</span>
                    <button onClick={() => removeCustomAttr(k)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={11}/></button>
                  </div>
                ))}
                {addingAttr && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input autoFocus value={newAttrKey} onChange={e=>setNewAttrKey(e.target.value)} placeholder="Variable name"
                        className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder-slate-300"/>
                      <input value={newAttrVal} onChange={e=>setNewAttrVal(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')addCustomAttr();if(e.key==='Escape')setAddingAttr(false)}}
                        placeholder="Value" className="text-[11px] border border-surface-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder-slate-300"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addCustomAttr} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90">Add Attribute</button>
                      <button onClick={()=>{setAddingAttr(false);setNewAttrKey('');setNewAttrVal('')}}
                        className="px-3 py-1.5 rounded-lg border border-surface-border text-slate-400 text-[11px] hover:bg-surface-hover">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => onDelete(c.id)}
              className="w-full py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-500 text-[11px] font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
              <Trash2 size={12}/>Delete Contact
            </button>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab==='activity' && (
          <div className="p-4">
            {!(c.log||[]).length
              ? <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock size={28} className="text-slate-300 mb-3"/>
                  <p className="text-[13px] font-semibold text-slate-500">No activity yet</p>
                </div>
              : <div className="space-y-3">
                  {(c.log||[]).map((l,i) => {
                    const s = LOG_ST[l.t] || LOG_ST.created
                    return (
                      <div key={i} className="flex items-start gap-3 bg-white border border-surface-border rounded-xl p-3.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background:s.bg}}>
                          <span className="w-2 h-2 rounded-full" style={{background:s.c}}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-700 leading-snug font-medium">{l.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{fmtD(l.date)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* NOTES TAB */}
        {tab==='notes' && (
          <div className="p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Private Notes</p>
              {noteDirty && (
                <button onClick={saveNote} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                  <CheckCircle2 size={11}/>Save
                </button>
              )}
              {!noteDirty && noteText.trim() && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500"><CheckCircle2 size={11}/>Saved</span>
              )}
            </div>
            <textarea value={noteText}
              onChange={e=>{setNoteText(e.target.value);setNoteDirty(e.target.value !== (c.notes||''))}}
              onBlur={saveNote} rows={16}
              placeholder="Add private notes about this contact…&#10;&#10;These notes are only visible to your team."
              className="w-full text-[12px] border border-surface-border rounded-xl p-4 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/30 resize-none transition-all leading-relaxed bg-slate-50/40 focus:bg-white"/>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 size={11} className="text-slate-300"/>Auto-saved when you click away</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── main ────────────────────────────────────────────────────── */
export default function WebChatContacts() {
  const navigate = useNavigate()
  const { everyConversation, selectConversation } = useConversations()

  const [contacts,    setCon]       = useState(WEBCHAT_CONTACTS)
  const [selId,       setSelId]     = useState(null)
  const [search,      setSearch]    = useState('')
  const [seg,         setSeg]       = useState('all')
  const [tagFil,      setTagFil]    = useState(null)
  const [dateFil,     setDateFil]   = useState('any')
  const [sourceFil,   setSourceFil] = useState(null)
  const [agentFil,    setAgentFil]  = useState(null)
  const [sortBy,      setSortBy]    = useState('recent')
  const [showAdd,     setAdd]       = useState(false)
  const [showImport,  setImport]    = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [groups,      setGroups]    = useState(INIT_GROUPS)
  const [groupFil,    setGroupFil]  = useState(null)
  const [showGroupDrop, setShowGroupDrop] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const groupDropRef = useRef(null)
  const [viewMode,    setViewMode]  = useState('list')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showSelectMenu, setShowSelectMenu] = useState(false)
  const [manualSelectMode, setManualSelectMode] = useState(false)
  const selectMenuRef = useRef(null)
  const [mobileContactView, setMobileContactView] = useState('list')

  const segCounts = useMemo(() => { const m = {}; SEGS.forEach(s => { m[s.id] = contacts.filter(s.fn).length }); return m }, [contacts])
  const tagCounts = useMemo(() => { const m = {}; contacts.forEach(c => c.tags.forEach(t => { m[t] = (m[t]||0)+1 })); return m }, [contacts])

  const list = useMemo(() => {
    const segFn = SEGS.find(s=>s.id===seg)?.fn || (()=>true)
    return contacts.filter(c => {
      if (!segFn(c)) return false
      if (tagFil    && !c.tags.includes(tagFil)) return false
      if (sourceFil && c.source !== sourceFil)   return false
      if (agentFil === 'unassigned' && c.agent)  return false
      if (agentFil && agentFil !== 'unassigned' && c.agent !== agentFil) return false
      if (!datePass(c, dateFil)) return false
      if (groupFil  && !(c.groupIds||[]).includes(groupFil)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) && !(c.phone||'').includes(q) &&
            !(c.email||'').toLowerCase().includes(q) && !(c.company||'').toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a,b) => {
      if (sortBy==='name-asc')  return a.name.localeCompare(b.name)
      if (sortBy==='name-desc') return b.name.localeCompare(a.name)
      if (sortBy==='convos')    return b.convos - a.convos
      return new Date(b.last) - new Date(a.last)
    })
  }, [contacts, seg, tagFil, sourceFil, agentFil, dateFil, sortBy, search, groupFil])

  const selContact = contacts.find(c=>c.id===selId) || null

  function upd(id, patch) { setCon(p=>p.map(c=>c.id===id?{...c,...patch}:c)) }
  function del(id)         { setCon(p=>p.filter(c=>c.id!==id)); if(selId===id) setSelId(null) }
  function add(c)          { setCon(p=>[c,...p]); setSelId(c.id) }
  function onImport(newContacts) {
    setCon(p => {
      const byKey = new Map(p.map(c => [(c.email||c.phone), c]))
      const brandNew = []
      const patches = new Map()
      newContacts.forEach(nc => {
        const key = nc.email || nc.phone
        const existing = key && byKey.get(key)
        if (existing) {
          patches.set(key, {
            groupIds: [...new Set([...(existing.groupIds||[]), ...(nc.groupIds||[])])],
            tags:     [...new Set([...(existing.tags||[]),     ...(nc.tags||[])])],
            customAttrs: { ...(existing.customAttrs||{}), ...(nc.customAttrs||{}) },
          })
        } else brandNew.push(nc)
      })
      const merged = p.map(c => patches.has(c.email||c.phone) ? { ...c, ...patches.get(c.email||c.phone) } : c)
      return [...brandNew, ...merged]
    })
  }

  // A conversation's email/phone only exists as a captured 'answer' message
  // (see the "Captured from Chat" panel in WebChatInbox.jsx), not a top-level
  // field — so matching by contact email/phone means checking those answers.
  function convAnswerValue(cv, questionType) {
    return cv.messages?.find(m => m.type === 'answer' && m.questionType === questionType)?.value
  }

  function goToChat(c) {
    // visitorId is the stable identity linking a contact to its conversation
    // (see the comment on WEBCHAT_CONVERSATIONS in constants/mockData.js) —
    // match on that first. Fall back to a captured email/phone answer for
    // contacts predating visitorId, and only fall back to name as a last
    // resort, since a visitor's display name can change once they're
    // identified mid-chat (e.g. "Visitor #5012" → "Jordan Lee") while their
    // conversation's name field lags behind.
    const conv = everyConversation.find(cv => cv.channel === 'webchat' && cv.visitorId && cv.visitorId === c.visitorId)
      || everyConversation.find(cv => cv.channel === 'webchat' && c.email && convAnswerValue(cv, 'email') === c.email)
      || everyConversation.find(cv => cv.channel === 'webchat' && c.phone && convAnswerValue(cv, 'phone') === c.phone)
      || everyConversation.find(cv => cv.channel === 'webchat' && cv.name === c.name)
    if (conv) selectConversation(conv.id)
    navigate('/webchat/inbox')
  }

  const counts = useMemo(() => ({ total: contacts.length, active: contacts.filter(c=>c.status==='active').length }), [contacts])
  const activeFilters = [seg!=='all', tagFil, sourceFil, agentFil, dateFil!=='any', sortBy!=='recent'].filter(Boolean).length
  function clearAll() { setSeg('all'); setTagFil(null); setDateFil('any'); setSourceFil(null); setAgentFil(null); setSortBy('recent') }

  function toggleSelect(id) { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleSelectAll(contactsList) {
    const allSel = contactsList.every(c => selectedIds.has(c.id))
    setSelectedIds(prev => { const n = new Set(prev); if (allSel) contactsList.forEach(c => n.delete(c.id)); else contactsList.forEach(c => n.add(c.id)); return n })
  }
  function bulkDelete() { setCon(p => p.filter(c => !selectedIds.has(c.id))); setSelectedIds(new Set()); setManualSelectMode(false) }
  function bulkExport() { exportContactsCSV(contacts.filter(c => selectedIds.has(c.id)), { filename: 'webchat_contacts_selected' }) }

  useEffect(() => {
    if (!showGroupDrop) return
    const h = e => { if (!groupDropRef.current?.contains(e.target)) setShowGroupDrop(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [showGroupDrop])
  useEffect(() => {
    if (!showSelectMenu) return
    const h = e => { if (!selectMenuRef.current?.contains(e.target)) setShowSelectMenu(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [showSelectMenu])

  function handleContactClick(id) { setSelId(p => p===id ? null : id); setMobileContactView('detail') }

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen -mx-3 -mt-3 -mb-3 sm:-mx-5 sm:-mt-5 sm:-mb-5 flex overflow-hidden">

      <div className={clsx('flex flex-col border-r border-surface-border bg-white overflow-hidden transition-all',
        viewMode === 'list'
          ? ['flex-shrink-0', 'w-full md:w-[280px]', mobileContactView === 'detail' ? 'hidden md:flex' : 'flex']
          : ['flex-1', mobileContactView === 'detail' ? 'hidden md:flex' : 'flex'])}>

        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-surface-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 leading-tight">Contacts</p>
            <p className="text-[10px] text-slate-400 truncate">{counts.total} contacts · {counts.active} active</p>
          </div>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            <button onClick={() => setViewMode('list')} title="List view"
              className={clsx('p-1 rounded-md transition-all', viewMode==='list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}><LayoutList size={12}/></button>
            <button onClick={() => setViewMode('table')} title="Table view"
              className={clsx('p-1 rounded-md transition-all', viewMode==='table' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}><Table2 size={12}/></button>
          </div>
          <button onClick={() => setShowFilters(p=>!p)} title="Filters"
            className={clsx('relative p-1.5 rounded-lg border transition-colors',
              activeFilters > 0 ? 'border-primary/30 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
            <SlidersHorizontal size={13}/>
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">{activeFilters}</span>}
          </button>
          <button onClick={() => setImport(true)} title="Import contacts" className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors"><Upload size={13}/></button>
          <button onClick={() => exportContactsCSV(contacts, { filename: 'webchat_contacts' })} title="Export contacts" className="p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors"><Download size={13}/></button>
          <button onClick={() => setAdd(true)} title="New contact" className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"><UserPlus size={13}/></button>
        </div>

        <div className="px-3 py-1.5 border-b border-surface-border flex-shrink-0 flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts…"
              className="pl-6 pr-2 py-1 text-[11px] bg-slate-50 border border-surface-border rounded-lg w-full focus:outline-none focus:border-primary/40 focus:bg-white transition-all placeholder-slate-400"/>
            {search && <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={10}/></button>}
          </div>

          <div className="relative flex-shrink-0" ref={selectMenuRef}>
            <button onClick={() => setShowSelectMenu(p => !p)} title="Select contacts"
              className={clsx('flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg border transition-colors',
                (manualSelectMode || selectedIds.size > 0) ? 'border-primary/30 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
              <CheckSquare size={13}/><ChevronDown size={10}/>
            </button>
            {showSelectMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-surface-border rounded-xl shadow-lg py-1 min-w-[190px]">
                <button onClick={() => { toggleSelectAll(list); setManualSelectMode(true); setShowSelectMenu(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                  <CheckSquare size={13} className="text-primary flex-shrink-0"/>Select all
                </button>
                <button onClick={() => { setManualSelectMode(true); setShowSelectMenu(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                  <MousePointer2 size={13} className="text-slate-400 flex-shrink-0"/>Select manually
                </button>
                {(manualSelectMode || selectedIds.size > 0) && (
                  <>
                    <div className="my-1 border-t border-surface-border"/>
                    <button onClick={() => { setSelectedIds(new Set()); setManualSelectMode(false); setShowSelectMenu(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors">
                      <X size={13} className="text-slate-400 flex-shrink-0"/>Clear selection
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="relative flex-shrink-0" ref={groupDropRef}>
            <button onClick={() => setShowGroupDrop(p=>!p)} title="Filter by group"
              className={clsx('relative p-1.5 rounded-lg border transition-colors', groupFil ? 'border-primary/30 bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-500 hover:bg-surface-hover')}>
              <Layers size={13}/>
              {groupFil && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white flex-shrink-0" style={{background: groups.find(g=>g.id===groupFil)?.color || '#0066ff'}}/>}
            </button>
            {showGroupDrop && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-surface-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
                <button onClick={() => { setGroupFil(null); setShowGroupDrop(false) }}
                  className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors', !groupFil ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-surface-hover')}>
                  <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"/>
                  <span className="flex-1 text-[11px] font-medium">All contacts</span>
                  {!groupFil && <CheckCircle2 size={10}/>}
                </button>
                {groups.map(g => {
                  const cnt = contacts.filter(c=>(c.groupIds||[]).includes(g.id)).length
                  const active = groupFil === g.id
                  return (
                    <button key={g.id} onClick={() => { setGroupFil(g.id); setShowGroupDrop(false) }}
                      className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors', active ? 'bg-primary-50' : 'hover:bg-surface-hover')}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:g.color}}/>
                      <span className={clsx('flex-1 text-[11px] font-medium truncate', active ? 'text-primary' : 'text-slate-600')}>{g.name}</span>
                      <span className={clsx('text-[10px] font-bold tabular-nums', active ? 'text-primary' : 'text-slate-400')}>{cnt}</span>
                    </button>
                  )
                })}
                {!groups.length && <p className="text-[11px] text-slate-400 italic px-3 py-2">No groups yet</p>}
              </div>
            )}
          </div>

          <button onClick={() => setShowCreateGroup(true)} title="Create new group" className="flex-shrink-0 p-1.5 rounded-lg border border-surface-border bg-white text-slate-500 hover:bg-surface-hover transition-colors"><FolderPlus size={13}/></button>
        </div>

        {(showFilters || activeFilters > 0) && (
          <div className="px-3 py-1.5 border-b border-surface-border flex-shrink-0 flex flex-wrap gap-1">
            <FilterChip label={seg === 'all' ? 'List' : SEGS.find(s=>s.id===seg)?.label} active={seg !== 'all'} onClear={() => setSeg('all')}>
              {({ close }) => (
                <div className="py-1">
                  {SEGS.map(s => <DropOpt key={s.id} label={s.label} count={segCounts[s.id]||0} active={seg===s.id} icon={s.icon} onClick={() => { setSeg(s.id); close() }}/>)}
                </div>
              )}
            </FilterChip>

            <FilterChip label={tagFil || 'Tags'} active={!!tagFil} onClear={() => setTagFil(null)}>
              {({ close }) => (
                <div className="py-1">
                  <DropOpt label="All tags" active={!tagFil} onClick={() => { setTagFil(null); close() }}/>
                  {Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).map(([t,cnt]) => (
                    <DropOpt key={t} label={t} count={cnt} active={tagFil===t}
                      icon={() => <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{background:tSt(t).color}}/>}
                      onClick={() => { setTagFil(t); close() }}/>
                  ))}
                </div>
              )}
            </FilterChip>

            <FilterChip label={sourceFil || 'Source'} active={!!sourceFil} onClear={() => setSourceFil(null)}>
              {({ close }) => (
                <div className="py-1">
                  <DropOpt label="All sources" active={!sourceFil} onClick={() => { setSourceFil(null); close() }}/>
                  {SOURCES.map(s => <DropOpt key={s} label={s} active={sourceFil===s} onClick={() => { setSourceFil(s); close() }}/>)}
                </div>
              )}
            </FilterChip>

            <FilterChip label={agentFil ? (agentFil === 'unassigned' ? 'Unassigned' : agentFil.split(' ')[0]) : 'Agent'} active={!!agentFil} onClear={() => setAgentFil(null)}>
              {({ close }) => (
                <div className="py-1">
                  <DropOpt label="All agents" active={!agentFil} onClick={() => { setAgentFil(null); close() }}/>
                  <DropOpt label="Unassigned" active={agentFil==='unassigned'} onClick={() => { setAgentFil('unassigned'); close() }}/>
                  {AGENTS.map(a => <DropOpt key={a} label={a} active={agentFil===a} onClick={() => { setAgentFil(a); close() }}/>)}
                </div>
              )}
            </FilterChip>

            <FilterChip label={SORT_OPTS.find(s=>s.id===sortBy)?.label || 'Sort'} active={sortBy !== 'recent'} onClear={() => setSortBy('recent')}>
              {({ close }) => (
                <div className="py-1">{SORT_OPTS.map(s => <DropOpt key={s.id} label={s.label} active={sortBy===s.id} onClick={() => { setSortBy(s.id); close() }}/>)}</div>
              )}
            </FilterChip>

            {activeFilters > 0 && (
              <button onClick={clearAll} className="text-[10px] text-red-500 hover:text-red-600 font-semibold px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors">Clear all</button>
            )}
            <span className="ml-auto text-[10px] text-slate-400 self-center">{list.length} {list.length===1?'contact':'contacts'}</span>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border-b border-primary/15">
            <span className="text-[11px] font-semibold text-primary mr-1">{selectedIds.size} selected</span>
            <button onClick={bulkExport} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-600 text-white text-[10px] font-semibold hover:bg-slate-700 transition-colors">
              <Download size={9}/>Export
            </button>
            <button onClick={bulkDelete} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500 text-white text-[10px] font-semibold hover:bg-red-600 transition-colors">
              <Trash2 size={9}/>Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-700 transition-colors">
              <X size={10}/>Clear
            </button>
          </div>
        )}

        {viewMode === 'list' ? (
          <>
            {list.length > 0 && (manualSelectMode || selectedIds.size > 0) && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-surface-border bg-primary-50/60 flex-shrink-0">
                <input type="checkbox"
                  ref={el => { if (el) el.indeterminate = list.some(c => selectedIds.has(c.id)) && !list.every(c => selectedIds.has(c.id)) }}
                  checked={list.length > 0 && list.every(c => selectedIds.has(c.id))}
                  onChange={() => toggleSelectAll(list)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"/>
                <span className="text-[10px] text-slate-500 select-none flex-1">
                  {selectedIds.size > 0 ? <><span className="font-semibold text-primary">{selectedIds.size}</span> of {list.length} selected</> : <span className="text-slate-400">Click contacts to select</span>}
                </span>
                <button onClick={() => { setSelectedIds(new Set()); setManualSelectMode(false) }} className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors px-1">Cancel</button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
              {!list.length
                ? <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <Users size={28} className="text-slate-300 mb-3"/>
                    <p className="text-[13px] font-semibold text-slate-500 mb-1">No contacts found</p>
                    <p className="text-[12px] text-slate-400">Try adjusting your search or filters</p>
                  </div>
                : list.map(c => (
                    <ContactRow key={c.id} c={c} active={selId===c.id} selected={selectedIds.has(c.id)}
                      onToggle={toggleSelect} manualSelect={manualSelectMode} onClick={() => handleContactClick(c.id)}/>
                  ))
              }
            </div>
          </>
        ) : (
          <ContactTable contacts={list} selId={selId} onContactClick={handleContactClick}
            selectedIds={selectedIds} onToggle={toggleSelect} onToggleAll={toggleSelectAll} onChat={goToChat}/>
        )}
      </div>

      <div className={clsx('flex flex-col overflow-hidden',
        viewMode === 'list'
          ? ['flex-1 min-w-0', mobileContactView === 'list' ? 'hidden md:flex' : 'flex']
          : selId ? 'flex flex-shrink-0 w-[380px] border-l border-surface-border' : 'hidden')}>
        <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-white border-b border-surface-border flex-shrink-0">
          <button onClick={() => setMobileContactView('list')} className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ArrowLeft size={14}/> Back to contacts
          </button>
        </div>
        {selContact
          ? <ContactPanel c={selContact} onClose={()=>{ setSelId(null); setMobileContactView('list') }} onUpdate={upd} onDelete={del} onChat={goToChat} groups={groups}/>
          : <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f8fc] text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-white border border-surface-border flex items-center justify-center mb-5">
                <Users size={32} className="text-slate-200"/>
              </div>
              <p className="font-semibold text-slate-600">Select a contact</p>
              <p className="text-sm text-slate-400 mt-1.5 max-w-xs">Choose from the list on the left to view profile</p>
              <button onClick={()=>setAdd(true)} className="mt-5 flex items-center gap-2 text-xs text-slate-400 bg-white px-4 py-2 rounded-full border border-surface-border hover:border-primary/30 hover:text-primary transition-colors">
                <Plus size={13}/>Add new contact
              </button>
            </div>
        }
      </div>

      {showAdd     && <AddModal onClose={()=>setAdd(false)} onAdd={add}/>}
      {showImport  && <GeneralImportModal onClose={()=>setImport(false)} onImport={onImport} groups={groups} idPrefix="wimp"/>}
      {showCreateGroup && <CreateGroupModal onClose={()=>setShowCreateGroup(false)} onSave={g=>setGroups(p=>[...p,g])} idPrefix="wgrp"/>}
    </div>
  )
}
