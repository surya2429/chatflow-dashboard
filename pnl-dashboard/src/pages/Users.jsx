import { useMemo, useState } from 'react'
import { ShieldCheck, UserCog, UserPlus, Pencil, Trash2, Check, Minus, Lock } from 'lucide-react'
import clsx from 'clsx'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { MODULES, ROLES, roleLabel, moduleLabel } from '../lib/domain'
import { fmtDate, fmtAgo, initials, avatarTone } from '../lib/format'
import {
  Card, PageHeader, Table, Modal, Field, Select, Badge, ConfirmDialog, Avatar,
  SectionHeader, StatCard, EmptyState, Toggle,
} from '../components/ui'

function UserEditor({ open, onClose, user, onSave }) {
  const [f, setF] = useState(
    user || { name: '', email: '', title: '', role: 'admin', permissions: ROLES.admin.modules, status: 'active' }
  )
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const isSuper = f.role === 'super_admin'

  const toggleModule = (id) => {
    const has = f.permissions.includes(id)
    set('permissions', has ? f.permissions.filter((m) => m !== id) : [...f.permissions, id])
  }

  const valid = f.name.trim() && /.+@.+\..+/.test(f.email)

  return (
    <Modal
      open={open} onClose={onClose}
      title={user ? 'Edit ' + user.name : 'Add an administrator'}
      subtitle="Choose the access level, then grant the operational modules this person needs."
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={() => { onSave(f); onClose() }}>Save user</button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="field" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Job title"><input className="field" value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Work email"><input className="field" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Access level">
            <Select
              value={f.role}
              onChange={(v) => {
                set('role', v)
                set('permissions', v === 'super_admin' ? ROLES.super_admin.modules : ROLES.admin.modules)
              }}
              options={Object.entries(ROLES).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Field>
        </div>

        <div className={clsx('rounded-xl border p-4', isSuper ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50')}>
          <div className="flex items-start gap-2.5">
            {isSuper ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600" /> : <UserCog size={16} className="mt-0.5 shrink-0 text-slate-500" />}
            <div>
              <p className="text-sm font-semibold text-navy-900">{roleLabel(f.role)}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{ROLES[f.role].blurb}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => {
              const on = isSuper || f.permissions.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={isSuper}
                  onClick={() => toggleModule(m.id)}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    on ? 'border-navy-300 bg-white text-navy-900' : 'border-slate-200 bg-white/60 text-slate-400',
                    isSuper ? 'cursor-not-allowed opacity-80' : 'hover:border-navy-400'
                  )}
                >
                  <span className={clsx('grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-300')}>
                    {on ? <Check size={11} /> : null}
                  </span>
                  <span className="flex-1 truncate font-medium">{m.label}</span>
                  {isSuper && <Lock size={12} className="shrink-0 text-amber-500" />}
                </button>
              )
            })}
          </div>
          {isSuper && <p className="mt-3 text-xs text-amber-700">Super Administrators always hold every module — permissions cannot be narrowed.</p>}
        </div>

        <Toggle
          checked={f.status === 'active'}
          onChange={(v) => set('status', v ? 'active' : 'suspended')}
          label="Account active"
          hint="Suspended users cannot sign in and are signed out immediately."
        />
      </div>
    </Modal>
  )
}

export default function Users() {
  const { db, saveUser, deleteUser } = useData()
  const { user: me, isSuper } = useAuth()
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const counts = useMemo(() => ({
    total: db.users.length,
    supers: db.users.filter((u) => u.role === 'super_admin').length,
    admins: db.users.filter((u) => u.role === 'admin').length,
    suspended: db.users.filter((u) => u.status !== 'active').length,
  }), [db.users])

  if (!isSuper) {
    return (
      <>
        <PageHeader title="Users & Permissions" />
        <Card className="p-16">
          <EmptyState
            icon={Lock}
            label="Super Administrators only"
            hint="User management and permission assignment are restricted to Super Administrator accounts."
          />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Users & Permissions"
        subtitle="Two levels of secure access: Super Administrators with complete control, and Administration Users limited to the modules you assign."
        actions={<button className="btn-primary" onClick={() => setEditing({ user: null })}><UserPlus size={16} /> Add administrator</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Administrators" value={counts.total} icon={UserCog} tone="navy" />
        <StatCard label="Super Administrators" value={counts.supers} icon={ShieldCheck} tone="amber" />
        <StatCard label="Administration Users" value={counts.admins} icon={UserCog} tone="cyan" />
        <StatCard label="Suspended" value={counts.suspended} icon={Minus} tone="red" />
      </div>

      <Card className="mt-6">
        <Table head={[
          { key: 'u', label: 'User' }, { key: 'r', label: 'Access level' },
          { key: 'p', label: 'Modules granted' }, { key: 'l', label: 'Last sign-in' },
          { key: 's', label: 'Status' }, { key: 'a', label: '' },
        ]}>
          {db.users.map((u) => (
            <tr key={u.id}>
              <td className="td">
                <div className="flex items-center gap-3">
                  <Avatar name={initials(u.name)} tone={avatarTone(u.name)} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">
                      {u.name}{u.id === me.id && <span className="ml-2 text-[11px] font-medium text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{u.title || u.email}</p>
                  </div>
                </div>
              </td>
              <td className="td">
                <Badge tone={u.role === 'super_admin' ? 'amber' : 'navy'} dot>{roleLabel(u.role)}</Badge>
              </td>
              <td className="td">
                {u.role === 'super_admin' ? (
                  <span className="text-xs text-slate-500">All {MODULES.length} modules</span>
                ) : (
                  <div className="flex max-w-[320px] flex-wrap gap-1">
                    {u.permissions.slice(0, 4).map((p) => <Badge key={p} tone="slate">{moduleLabel(p)}</Badge>)}
                    {u.permissions.length > 4 && <Badge tone="slate">+{u.permissions.length - 4}</Badge>}
                    {u.permissions.length === 0 && <span className="text-xs text-slate-400">None assigned</span>}
                  </div>
                )}
              </td>
              <td className="td whitespace-nowrap text-slate-600">
                {u.lastLogin ? <>{fmtDate(u.lastLogin)}<p className="text-[11px] text-slate-400">{fmtAgo(u.lastLogin)}</p></> : <span className="text-slate-400">Never</span>}
              </td>
              <td className="td">
                <Badge tone={u.status === 'active' ? 'green' : 'red'} dot>{u.status === 'active' ? 'Active' : 'Suspended'}</Badge>
              </td>
              <td className="td text-right">
                <div className="flex justify-end gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ user: u })}><Pencil size={13} /></button>
                  <button
                    className="btn-ghost btn-sm text-red-600"
                    disabled={u.id === me.id}
                    title={u.id === me.id ? 'You cannot remove your own account' : 'Remove user'}
                    onClick={() => setConfirm(u)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {Object.entries(ROLES).map(([key, role]) => (
          <Card key={key} className="card-pad">
            <SectionHeader
              title={role.label}
              subtitle={role.blurb}
              actions={<Badge tone={key === 'super_admin' ? 'amber' : 'navy'} dot>{db.users.filter((u) => u.role === key).length} users</Badge>}
            />
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {MODULES.map((m) => {
                const on = key === 'super_admin' || role.modules.includes(m.id)
                return (
                  <p key={m.id} className={clsx('flex items-center gap-2 text-xs', on ? 'text-navy-800' : 'text-slate-400')}>
                    {on ? <Check size={13} className="shrink-0 text-emerald-600" /> : <Minus size={13} className="shrink-0 text-slate-300" />}
                    {m.label}
                  </p>
                )
              })}
            </div>
            {key === 'admin' && (
              <p className="mt-4 text-xs text-slate-500">Default set for new Administration Users — adjust per person when adding them.</p>
            )}
          </Card>
        ))}
      </div>

      {editing && (
        <UserEditor
          open
          onClose={() => setEditing(null)}
          user={editing.user}
          onSave={(u) => saveUser(u, me.name)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteUser(confirm.id, me.name)}
        title="Remove this administrator?"
        message={confirm ? confirm.name + ' will lose access to the dashboard immediately.' : ''}
        confirmLabel="Remove user"
        danger
      />
    </>
  )
}
