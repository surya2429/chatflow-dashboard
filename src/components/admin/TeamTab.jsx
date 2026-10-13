// TeamTab.jsx — SmatBot employees who can sign in to this console. Admins only.
//   Admin    everything: assign plans, coupons, the team
//   Support  sees clients and renewals, opens a customer's dashboard; moves no money
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Plus, Loader2, KeyRound } from 'lucide-react'
import { billingAdmin } from '../../lib/billingApi'
import Select from '../Select'
import { Modal, ErrorNote, fmtDate, inputCls, labelCls, btnPrimary, btnGhost, initialsOf } from './ui'

const ROLES = [
  { value: 'admin', label: 'Admin', sub: 'Everything, incl. plans, coupons and the team' },
  { value: 'support', label: 'Support', sub: 'Clients & renewals, log in as customer' },
]

function PasswordField({ id, value, onChange, label = 'Password' }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label} <span className="font-normal text-slate-400">(at least 8 characters)</span></label>
      <input id={id} type="password" autoComplete="new-password" required minLength={8} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}/>
    </div>
  )
}

function NewMember({ token, onDone, onClose }) {
  const [f, setF] = useState({ name: '', email: '', role: 'support', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try { onDone(await billingAdmin.createStaff(token, f)) } catch (err) { setError(err.message); setSaving(false) }
  }
  return (
    <Modal title="Add an employee" subtitle="They sign in at this page with their email and the password you set. Share it with them privately." onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label htmlFor="tm-name" className={labelCls}>Name</label>
          <input id="tm-name" required value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={inputCls}/>
        </div>
        <div>
          <label htmlFor="tm-email" className={labelCls}>Work email</label>
          <input id="tm-email" type="email" required autoComplete="off" value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputCls}/>
        </div>
        <fieldset>
          <legend className={labelCls}>Role</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <label key={r.value} className={clsx('border rounded-xl px-3 py-2 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30',
                f.role === r.value ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300')}>
                <input type="radio" name="tm-role" value={r.value} checked={f.role === r.value} onChange={() => set({ role: r.value })} className="sr-only"/>
                <div className="text-sm font-semibold text-slate-800">{r.label}</div>
                <div className="text-[11px] text-slate-500 leading-snug">{r.sub}</div>
              </label>
            ))}
          </div>
        </fieldset>
        <PasswordField id="tm-pass" value={f.password} onChange={(password) => set({ password })}/>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} Add employee</button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPassword({ token, member, onDone, onClose }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try { onDone(await billingAdmin.updateStaff(token, { email: member.email, password })) } catch (err) { setError(err.message); setSaving(false) }
  }
  return (
    <Modal title={`New password for ${member.name}`} subtitle={member.email} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <PasswordField id="tm-reset" label="New password" value={password} onChange={setPassword}/>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving && <Loader2 size={14} className="animate-spin"/>} Set password</button>
        </div>
      </form>
    </Modal>
  )
}

export default function TeamTab({ token, me }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState(null)
  const [busy, setBusy] = useState('')

  useEffect(() => { billingAdmin.staff(token).then(setData).catch((e) => setError(e.message)) }, [token])

  const replace = (m) => setData((d) => ({ ...d, items: d.items.map((x) => (x.email === m.email ? m : x)) }))
  async function update(member, patch) {
    setBusy(member.email); setError('')
    try { replace(await billingAdmin.updateStaff(token, { email: member.email, ...patch })) } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-800">Team</h2>
          <p className="text-xs text-slate-500">Employees who can sign in to this console. Switching someone off signs them out straight away.</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={btnPrimary}><Plus size={14}/> Add employee</button>
      </div>
      {error && <div className="p-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50">
              <th className="px-4 py-2.5 font-semibold">Employee</th>
              <th className="px-3 py-2.5 font-semibold w-44">Role</th>
              <th className="px-3 py-2.5 font-semibold">Last sign-in</th>
              <th className="px-3 py-2.5 font-semibold">Access</th>
              <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {data && (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">Owner</div>
                  <div className="text-xs text-slate-400">{data.owner.email}</div>
                </td>
                <td className="px-3 py-3 text-slate-600 text-xs">Owner · full access</td>
                <td className="px-3 py-3 text-slate-400 text-xs">—</td>
                <td className="px-3 py-3 text-xs text-slate-500">Set on the server</td>
                <td/>
              </tr>
            )}
            {data?.items.map((m) => (
              <tr key={m.email} className={clsx('border-t border-slate-100', !m.active && 'opacity-60')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{initialsOf(m.name)}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{m.name}{m.email === me.email && <span className="text-slate-400 font-normal"> (you)</span>}</div>
                      <div className="text-xs text-slate-400 truncate">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Select size="sm" value={m.role} disabled={busy === m.email || m.email === me.email} onChange={(role) => role !== m.role && update(m, { role })}
                    options={ROLES.map((r) => ({ value: r.value, label: r.label }))}/>
                </td>
                <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">{m.lastLoginAt ? fmtDate(m.lastLoginAt) : 'Never'}</td>
                <td className="px-3 py-3 text-xs font-semibold">{m.active ? <span className="text-emerald-700">On</span> : <span className="text-slate-500">Off</span>}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button type="button" onClick={() => setResetting(m)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-primary mr-3"><KeyRound size={12}/> Reset password</button>
                  {m.email !== me.email && (
                    <button type="button" disabled={busy === m.email} onClick={() => update(m, { active: !m.active })} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                      {m.active ? 'Switch off' : 'Switch on'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No employees yet. Add one to give them their own login.</td></tr>}
            {!data && !error && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400"><Loader2 size={18} className="animate-spin inline"/></td></tr>}
          </tbody>
        </table>
      </div>
      {adding && <NewMember token={token} onClose={() => setAdding(false)} onDone={(m) => { setData((d) => ({ ...d, items: [...d.items, m] })); setAdding(false) }}/>}
      {resetting && <ResetPassword token={token} member={resetting} onClose={() => setResetting(null)} onDone={(m) => { replace(m); setResetting(null) }}/>}
    </section>
  )
}
