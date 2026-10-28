// ClientDocuments.jsx — files attached to a client (a PO, the signed agreement …): list, download,
// attach and remove. PDF, images, Word, Excel, CSV or text, up to 2 MB each and 10 per client.
import { useRef, useState } from 'react'
import { Download, Trash2, Loader2, Upload, FileText } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import { ErrorNote, fmtDate, btnGhost } from './ui'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx'
const MAX = 2 * 1024 * 1024
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const toBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.onerror = reject
  r.readAsDataURL(file)
})

export default function ClientDocuments({ token, workspaceId, initial = [], canEdit }) {
  const [docs, setDocs] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)

  async function attach(files) {
    setError('')
    setBusy(true)
    for (const f of files) {
      if (f.size > MAX) { setError(`${f.name} is over 2 MB.`); continue }
      try {
        setDocs((await billingAdmin.addDocument(token, { workspaceId, name: f.name, type: f.type, data: await toBase64(f) })).documents)
      } catch (e) { setError(`${f.name}: ${e.message}`) }
    }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  async function download(d) {
    try {
      const f = await billingAdmin.document(token, workspaceId, d.id)
      const bytes = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: f.type }))
      const a = document.createElement('a')
      a.href = url; a.download = f.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e.message) }
  }

  async function remove(d) {
    if (!window.confirm(`Remove ${d.name}?`)) return
    try { setDocs((await billingAdmin.removeDocument(token, workspaceId, d.id)).documents) } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" id={`docs-${workspaceId}`} onChange={(e) => attach([...e.target.files])}/>
          <label htmlFor={`docs-${workspaceId}`} className={`${btnGhost} cursor-pointer border-dashed`}>
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} Upload file
          </label>
          <span className="text-xs text-slate-400">Up to 10 files, 2 MB each — PDF, image, Word, Excel, CSV or text.</span>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      {docs.length ? (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText size={16} className="text-slate-400 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{d.name}</div>
                <div className="text-[11px] text-slate-400">{size(d.size)} · {fmtDate(d.at)} · {d.by}</div>
              </div>
              <button type="button" onClick={() => download(d)} aria-label={`Download ${d.name}`} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Download size={14}/></button>
              {canEdit && <button type="button" onClick={() => remove(d)} aria-label={`Remove ${d.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-400">No files attached.</p>}
    </div>
  )
}
