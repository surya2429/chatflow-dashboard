import { useMemo, useState } from 'react'
import { Building2, Plus, Pencil, Trash2, MapPin, Users as UsersIcon, Package, Lock } from 'lucide-react'
import clsx from 'clsx'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { BRANCH_TYPES } from '../lib/domain'
import { fmtDate, fmtNum, fmtMoney } from '../lib/format'
import {
  Card, PageHeader, Table, SearchInput, Select, Modal, Field, Badge, ConfirmDialog,
  StatCard, EmptyState, SectionHeader, Toggle,
} from '../components/ui'

const blank = {
  code: '', name: '', city: '', country: '', type: 'depot',
  manager: '', phone: '', address: '', staffCount: 0, status: 'active',
}

function BranchEditor({ open, onClose, branch, onSave, takenCodes }) {
  const [f, setF] = useState(branch || blank)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const codeClash = !branch && takenCodes.includes(f.code.toUpperCase())
  const valid = f.code.trim().length >= 2 && f.name.trim() && f.city.trim() && f.country.trim() && !codeClash

  return (
    <Modal
      open={open} onClose={onClose}
      title={branch ? 'Edit ' + branch.name : 'Open a branch'}
      subtitle="Active branches become bookable routes on every order form straight away."
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={() => { onSave({ ...f, code: f.code.toUpperCase() }); onClose() }}>
            Save branch
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Branch code" hint={codeClash ? '' : 'Three letters, shown on tracking milestones'}>
            <input
              className="field font-mono uppercase" maxLength={4} value={f.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
            {codeClash && <span className="mt-1 block text-xs text-red-600">That code is already in use</span>}
          </Field>
          <Field label="Branch name" className="sm:col-span-2">
            <input className="field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Dubai — Al Quoz HQ" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><input className="field" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Country"><input className="field" value={f.country} onChange={(e) => set('country', e.target.value)} /></Field>
        </div>

        <Field label="Street address">
          <input className="field" value={f.address} onChange={(e) => set('address', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Facility type">
            <Select
              value={f.type} onChange={(v) => set('type', v)}
              options={Object.entries(BRANCH_TYPES).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Field>
          <Field label="Branch manager"><input className="field" value={f.manager} onChange={(e) => set('manager', e.target.value)} /></Field>
          <Field label="Headcount">
            <input type="number" min="0" className="field tnum" value={f.staffCount} onChange={(e) => set('staffCount', Number(e.target.value))} />
          </Field>
        </div>

        <Field label="Phone"><input className="field" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>

        <Toggle
          checked={f.status === 'active'}
          onChange={(v) => set('status', v ? 'active' : 'onboarding')}
          label="Active and routable"
          hint="Branches still onboarding stay off the booking forms until you switch them on."
        />
      </div>
    </Modal>
  )
}

/**
 * The network behind the website's "Our Network" page. Every branch is a routable point on
 * the order form, which is why opening or pausing one has an immediate operational effect.
 */
export default function Branches() {
  const { db, saveBranch, deleteBranch } = useData()
  const { user, isSuper } = useAuth()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  /** Volume and value routed through each branch, either as origin or destination. */
  const stats = useMemo(() => {
    const map = {}
    db.branches.forEach((b) => { map[b.id] = { shipments: 0, revenue: 0, customers: 0 } })
    db.orders.forEach((o) => {
      const touch = [o.origin.branchId, o.destination.branchId].filter(Boolean)
      new Set(touch).forEach((id) => {
        if (!map[id]) return
        map[id].shipments += 1
        if (o.status !== 'cancelled' && o.status !== 'rejected') map[id].revenue += o.amount
      })
    })
    db.customers.forEach((c) => { if (map[c.branchId]) map[c.branchId].customers += 1 })
    return map
  }, [db.branches, db.orders, db.customers])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.branches.filter((b) => {
      if (type !== 'all' && b.type !== type) return false
      if (!term) return true
      return b.name.toLowerCase().includes(term) || b.city.toLowerCase().includes(term)
        || b.country.toLowerCase().includes(term) || b.code.toLowerCase().includes(term)
        || (b.manager || '').toLowerCase().includes(term)
    })
  }, [db.branches, q, type])

  if (!isSuper) {
    return (
      <>
        <PageHeader title="Branches & Network" />
        <Card className="p-16">
          <EmptyState
            icon={Lock}
            label="Super Administrators only"
            hint="Opening, editing and closing branches is restricted to Super Administrator accounts."
          />
        </Card>
      </>
    )
  }

  const totals = {
    all: db.branches.length,
    active: db.branches.filter((b) => b.status === 'active').length,
    countries: new Set(db.branches.map((b) => b.country)).size,
    staff: db.branches.reduce((s, b) => s + (b.staffCount || 0), 0),
  }

  return (
    <>
      <PageHeader
        title="Branches & Network"
        subtitle="Every hub, depot and partner agent in the network. Active branches are bookable routes on the order forms."
        actions={<button className="btn-primary" onClick={() => setEditing({ branch: null })}><Plus size={16} /> Open a branch</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Branches" value={totals.all} icon={Building2} tone="navy" hint={totals.active + ' active and routable'} />
        <StatCard label="Countries covered" value={totals.countries} icon={MapPin} tone="cyan" />
        <StatCard label="Network headcount" value={fmtNum(totals.staff)} icon={UsersIcon} tone="amber" />
        <StatCard label="Shipments routed" value={fmtNum(db.orders.length)} icon={Package} tone="green" />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Branch, city, country, code or manager…" className="min-w-[240px] flex-1" />
          <Select
            value={type} onChange={setType} className="w-48"
            options={[{ value: 'all', label: 'All facility types' }, ...Object.entries(BRANCH_TYPES).map(([k, v]) => ({ value: k, label: v.label }))]}
          />
        </div>

        <Table
          head={[
            { key: 'b', label: 'Branch' }, { key: 'loc', label: 'Location' }, { key: 't', label: 'Type' },
            { key: 'm', label: 'Manager' }, { key: 's', label: 'Shipments', align: 'right' },
            { key: 'r', label: 'Routed value', align: 'right' }, { key: 'st', label: 'Status' }, { key: 'a', label: '' },
          ]}
          empty={rows.length === 0}
          emptyLabel="No branches match this search"
        >
          {rows.map((b) => {
            const s = stats[b.id] || { shipments: 0, revenue: 0, customers: 0 }
            return (
              <tr key={b.id}>
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-bold',
                      b.status === 'active' ? 'bg-navy-100 text-navy-700' : 'bg-slate-100 text-slate-400')}>
                      {b.code}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900">{b.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{s.customers} customers · opened {fmtDate(b.openedAt)}</p>
                    </div>
                  </div>
                </td>
                <td className="td whitespace-nowrap text-slate-600">
                  {b.city}
                  <p className="text-[11px] text-slate-400">{b.country}</p>
                </td>
                <td className="td"><Badge tone="slate">{BRANCH_TYPES[b.type] ? BRANCH_TYPES[b.type].label : b.type}</Badge></td>
                <td className="td whitespace-nowrap text-slate-600">
                  {b.manager || '—'}
                  <p className="text-[11px] text-slate-400">{b.staffCount} staff</p>
                </td>
                <td className="td text-right tnum whitespace-nowrap">{fmtNum(s.shipments)}</td>
                <td className="td text-right tnum font-semibold whitespace-nowrap">{fmtMoney(s.revenue)}</td>
                <td className="td">
                  <Badge tone={b.status === 'active' ? 'green' : 'amber'} dot>
                    {b.status === 'active' ? 'Active' : 'Onboarding'}
                  </Badge>
                </td>
                <td className="td text-right">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing({ branch: b })}><Pencil size={13} /></button>
                    <button
                      className="btn-ghost btn-sm text-red-600"
                      disabled={s.shipments > 0}
                      title={s.shipments > 0 ? 'This branch has routed shipments and cannot be removed' : 'Close branch'}
                      onClick={() => setConfirm(b)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </Table>
      </Card>

      <Card className="card-pad mt-5">
        <SectionHeader
          title="How branches are used"
          subtitle="A branch is a routable point on every order form, the hub code stamped on tracking milestones, and the coverage list published on the website's Our Network page. Branches that have already routed shipments cannot be deleted — switch them to onboarding to take them off the booking forms instead."
        />
      </Card>

      {editing && (
        <BranchEditor
          open
          onClose={() => setEditing(null)}
          branch={editing.branch}
          takenCodes={db.branches.map((b) => b.code)}
          onSave={(b) => saveBranch(b, user.name)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteBranch(confirm.id, user.name)}
        title="Close this branch?"
        message={confirm ? confirm.name + ' will be removed from the network and will no longer appear on booking forms.' : ''}
        confirmLabel="Close branch"
        danger
      />
    </>
  )
}
