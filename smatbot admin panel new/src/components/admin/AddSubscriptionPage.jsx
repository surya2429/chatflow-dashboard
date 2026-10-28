// AddSubscriptionPage.jsx — set up a subscription without hunting for the client in the list:
// pick an existing client (type to search) or start a new one, then work through the tabs.
import { useState } from 'react'
import Select from '../Select'
import SubscriptionDialog from './SubscriptionDialog'

export default function AddSubscriptionPage({ token, customers, plans, addonDefs, states, sac, onDone }) {
  const [who, setWho] = useState('new')           // 'new' or a workspace id
  const [round, setRound] = useState(0)           // a fresh, empty form after each save
  const client = customers.find((c) => c.workspaceId === who)
  const reset = () => { setWho('new'); setRound((r) => r + 1) }

  const picker = (
    <Select size="sm" value={who} onChange={(v) => { setWho(v); setRound((r) => r + 1) }}
      options={[{ value: 'new', label: 'New client', sub: 'Fill in their details' },
        ...customers.map((c) => ({ value: c.workspaceId, label: c.customer || c.workspaceId, sub: [c.email, c.planName].filter(Boolean).join(' · ') || c.workspaceId }))]}/>
  )

  return (
    <SubscriptionDialog key={`${who}:${round}`} inline token={token} initial={client || null} plans={plans} addonDefs={addonDefs} states={states} sac={sac}
      picker={picker} onClose={reset} onDone={(row) => { reset(); onDone(row) }}/>
  )
}
