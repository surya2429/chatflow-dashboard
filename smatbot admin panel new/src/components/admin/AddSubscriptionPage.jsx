// AddSubscriptionPage.jsx — set up a subscription without hunting for the client in the list:
// pick an existing client (type to search) or start a new one, then fill in the subscription.
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import Select from '../Select'
import SubscriptionDialog from './SubscriptionDialog'

export default function AddSubscriptionPage({ token, customers, plans, addonDefs, states, sac, onDone }) {
  const [who, setWho] = useState('new')           // 'new' or a workspace id
  const [round, setRound] = useState(0)           // a fresh, empty form after each save
  const client = customers.find((c) => c.workspaceId === who)
  const reset = () => { setWho('new'); setRound((r) => r + 1) }

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><UserPlus size={16}/></span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Who is this for?</h2>
          <p className="text-xs text-slate-500">Search a client you already have, or add a new one.</p>
        </div>
        <div className="w-full sm:w-96 sm:ml-auto">
          <Select value={who} onChange={(v) => { setWho(v); setRound((r) => r + 1) }}
            options={[{ value: 'new', label: 'New client', sub: 'Fill in their details below' },
              ...customers.map((c) => ({ value: c.workspaceId, label: c.customer || c.workspaceId, sub: [c.email, c.planName].filter(Boolean).join(' · ') || c.workspaceId }))]}/>
        </div>
      </section>

      <SubscriptionDialog key={`${who}:${round}`} inline token={token} initial={client || null} plans={plans} addonDefs={addonDefs} states={states} sac={sac}
        onClose={reset} onDone={(row) => { reset(); onDone(row) }}/>
    </div>
  )
}
