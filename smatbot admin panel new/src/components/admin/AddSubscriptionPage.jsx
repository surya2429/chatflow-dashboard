// AddSubscriptionPage.jsx — set up a subscription without hunting for the client in the list:
// pick an existing client (or start a new one), then the same form as the client list's dialog.
import { useState } from 'react'
import Select from '../Select'
import SubscriptionDialog from './SubscriptionDialog'
import { Chips, StatusPill, fmtDate } from './ui'

export default function AddSubscriptionPage({ token, customers, plans, addonDefs, states, onDone }) {
  const [who, setWho] = useState('existing')     // existing · new
  const [ws, setWs] = useState('')
  const [round, setRound] = useState(0)           // a fresh, empty form after each save
  const client = customers.find((c) => c.workspaceId === ws)

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <fieldset>
          <legend className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Client</legend>
          <Chips label="Client" value={who} onChange={(v) => { setWho(v); setWs('') }} options={[['existing', 'Existing client'], ['new', 'New client']]}/>
        </fieldset>
        {who === 'existing' && (
          <div className="w-full sm:w-96">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Search and pick</p>
            <Select value={ws} onChange={setWs} placeholder="Choose a client…"
              options={customers.map((c) => ({ value: c.workspaceId, label: c.customer || c.workspaceId, sub: [c.email, c.planName].filter(Boolean).join(' · ') || c.workspaceId }))}/>
          </div>
        )}
        {client && (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <StatusPill status={client.status}/>
            {client.planName ? `${client.planName} until ${fmtDate(client.currentEnd)}` : 'No plan yet'}
          </p>
        )}
      </section>

      {who === 'new' && (
        <SubscriptionDialog key={`new:${round}`} inline token={token} initial={null} plans={plans} addonDefs={addonDefs} states={states}
          onClose={() => setRound((r) => r + 1)} onDone={(row) => { setRound((r) => r + 1); onDone(row) }}/>
      )}
      {who === 'existing' && client && (
        <SubscriptionDialog key={`${ws}:${round}`} inline token={token} initial={client} plans={plans} addonDefs={addonDefs} states={states}
          onClose={() => setWs('')} onDone={(row) => { setWs(''); setRound((r) => r + 1); onDone(row) }}/>
      )}
      {who === 'existing' && !client && (
        <p className="text-sm text-slate-400 text-center py-10">Pick a client to set up their plan, add-ons, cycles, discount and payment.</p>
      )}
    </div>
  )
}
