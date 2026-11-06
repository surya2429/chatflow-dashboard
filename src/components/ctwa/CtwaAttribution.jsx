import { useCallback, useEffect, useState } from 'react'
import { Send, Loader2, FlaskConical } from 'lucide-react'
import { ctwa } from '../../lib/ctwaApi'
import EventDialog from './EventDialog'
import { EventChips } from './Leads'

/* In the inbox: which ad started this chat, and a way to tell Meta what came of it (Lead, Qualified, Purchase …).
   The chat is matched to its ad by WhatsApp number. Renders nothing when the chat did not come from an ad. */
export default function CtwaAttribution({ phone, fallback }) {
  const digits = String(phone || '').replace(/\D/g, '')
  const [state, setState] = useState({ loading: digits.length >= 6, lead: null, mode: null })
  const [dialog, setDialog] = useState(null)

  const load = useCallback(() => {
    if (digits.length < 6) return setState({ loading: false, lead: null, mode: null })
    ctwa.lead(digits).then((r) => setState({ loading: false, lead: r.lead, mode: r.mode })).catch(() => setState({ loading: false, lead: null, mode: null }))
  }, [digits])
  useEffect(() => { setState({ loading: digits.length >= 6, lead: null, mode: null }); load() }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state.loading) return <div className="mt-4 mx-4 py-3 flex justify-center"><Loader2 size={14} className="animate-spin text-slate-300" /></div>
  const l = state.lead
  if (!l) return fallback ?? null

  return (
    <div className="mt-4 mx-4">
      <div className="rounded-xl p-3 bg-blue-50 border border-blue-100">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex-1">Came from an ad</p>
          {state.mode === 'sample' && <span title="Sample data: events are recorded as tests" className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700"><FlaskConical size={10} /> Sample</span>}
        </div>
        <p className="text-xs font-bold text-slate-800 leading-snug">{l.adName || l.headline || 'Click-to-WhatsApp ad'}</p>
        {l.adName && l.headline && <p className="text-[11px] text-slate-600 mt-0.5">“{l.headline}”</p>}
        <p className="text-[10px] text-slate-400 mt-1">{new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{l.sourceId && ` · Ad ${l.sourceId.slice(-8)}`}</p>

        <div className="mt-2.5"><EventChips events={l.events} /></div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {[['QualifiedLead', 'Qualified'], ['Purchase', 'Purchase']].map(([ev, label]) => (
            <button key={ev} onClick={() => setDialog(ev)} className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">{label}</button>
          ))}
          <button onClick={() => setDialog('LeadSubmitted')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary-hover"><Send size={10} /> More events</button>
        </div>
      </div>
      {dialog && <EventDialog lead={l} initial={dialog} onClose={() => setDialog(null)} onSent={load} />}
    </div>
  )
}
