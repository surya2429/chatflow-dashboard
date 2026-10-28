// AddSubscriptionPage.jsx — the subscriptions added from this panel, and the button that adds one.
// "Add subscription" opens the form (Client details → Plan & schedule → Payment → Summary) for a new
// client, or for one picked from the list; saving brings you back here, with it in the list.
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Select from '../Select'
import SubscriptionDialog from './SubscriptionDialog'
import SubscriptionsList from './SubscriptionsList'
import RenewDialog from './RenewDialog'

export default function AddSubscriptionPage({ token, customers, plans, addonDefs, states, sac, gstPercent, canEdit, onOpen, onAssign, onDone, onRenewed }) {
  const [creating, setCreating] = useState(false)
  const [who, setWho] = useState('new')           // 'new' or a workspace id
  const [round, setRound] = useState(0)           // a fresh, empty form each time it opens
  const [renewing, setRenewing] = useState(null)
  const client = customers.find((c) => c.workspaceId === who)
  const close = () => setCreating(false)

  if (creating) {
    const picker = (
      <Select size="sm" value={who} onChange={(v) => { setWho(v); setRound((r) => r + 1) }}
        options={[{ value: 'new', label: 'New client', sub: 'Fill in their details' },
          ...customers.map((c) => ({ value: c.workspaceId, label: c.customer || c.workspaceId, sub: [c.email, c.planName].filter(Boolean).join(' · ') || c.workspaceId }))]}/>
    )
    return (
      <div className="space-y-3 max-w-4xl mx-auto">
        <button type="button" onClick={close} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={15}/> All subscriptions</button>
        <SubscriptionDialog key={`${who}:${round}`} inline token={token} initial={client || null} plans={plans} addonDefs={addonDefs} states={states} sac={sac} gstPercent={gstPercent}
          picker={picker} onClose={close} onDone={(row) => { close(); onDone(row) }}/>
      </div>
    )
  }

  return (
    <>
      <SubscriptionsList customers={customers} canEdit={canEdit} onOpen={onOpen} onChange={onAssign} onRecord={setRenewing}
        onAdd={() => { setWho('new'); setRound((r) => r + 1); setCreating(true) }}/>
      {renewing && <RenewDialog token={token} client={renewing} onClose={() => setRenewing(null)} onDone={(row) => { setRenewing(null); onRenewed(row) }}/>}
    </>
  )
}
