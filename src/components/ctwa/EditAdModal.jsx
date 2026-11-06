import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ctwa, money } from '../../lib/ctwaApi'
import { Banner, btnGhostXl, btnPrimaryXl, Field, inputCls, Modal } from './ui'

/** Rename an ad or change its daily budget. */
export default function EditAdModal({ ad, currency, onClose, onSaved, notify }) {
  const [name, setName] = useState(ad.name)
  const [budget, setBudget] = useState(String(ad.dailyBudget ?? ''))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')

  async function save() {
    const e = {}
    if (name.trim().length < 2) e.name = 'Give the ad a name (at least 2 characters).'
    if (!(Number(budget) > 0)) e.dailyBudget = 'Enter a daily budget above 0.'
    setErrors(e)
    if (Object.keys(e).length) return
    const patch = {}
    if (name.trim() !== ad.name) patch.name = name.trim()
    if (Number(budget) !== ad.dailyBudget) patch.dailyBudget = Number(budget)
    if (!Object.keys(patch).length) return onClose()
    setBusy(true); setError('')
    try {
      await ctwa.updateAd(ad.id, patch)
      notify(patch.dailyBudget ? `Daily budget is now ${money(patch.dailyBudget, currency)}.` : 'Name updated.', 'ok')
      onSaved(); onClose()
    } catch (err) { setError(err.message); setErrors(err.fields || {}) } finally { setBusy(false) }
  }

  return (
    <Modal title="Edit ad" sub={`ID ${ad.id}`} size="max-w-md" onClose={onClose}
      footer={<><span /><div className="flex items-center gap-2.5">
        <button onClick={onClose} className={btnGhostXl}>Cancel</button>
        <button onClick={save} disabled={busy} className={btnPrimaryXl}>{busy && <Loader2 size={13} className="animate-spin" />} Save changes</button>
      </div></>}>
      <div className="p-6 space-y-4">
        {error && <Banner tone="error">{error}</Banner>}
        <Field label="Ad name" error={errors.name}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputCls} autoFocus /></Field>
        <Field label={`Daily budget (${currency})`} error={errors.dailyBudget} hint="Applies to the ad set. Meta may take a few minutes to start using the new amount.">
          <input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </Modal>
  )
}
