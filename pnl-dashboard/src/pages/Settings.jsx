import { useState } from 'react'
import { Building2, Languages, ShieldCheck, Hash, Plus, X, Database } from 'lucide-react'
import { useData } from '../store/DataContext'
import { Card, PageHeader, Field, Toggle, SectionHeader, Badge, ConfirmDialog } from '../components/ui'

const LANGUAGE_POOL = ['English', 'Nigerian Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'French', 'Arabic', 'Portuguese', 'Mandarin', 'Fulfulde']

export default function Settings() {
  const { db, updateSettings, resetData } = useData()
  const s = db.settings
  const [draft, setDraft] = useState(s)
  const [confirmReset, setConfirmReset] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(s)
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const toggleLanguage = (lang) => {
    const has = draft.languages.includes(lang)
    if (!has && draft.languages.length >= 6) return   // brief caps the website at six languages
    set('languages', has ? draft.languages.filter((l) => l !== lang) : [...draft.languages, lang])
  }

  return (
    <>
      <PageHeader
        title="System Settings"
        subtitle="Company details, tracking format, delivery proof requirements and the languages the public website is published in."
        actions={
          <>
            <button className="btn-ghost" disabled={!dirty} onClick={() => setDraft(s)}>Discard</button>
            <button className="btn-primary" disabled={!dirty} onClick={() => updateSettings(draft)}>Save settings</button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="card-pad">
          <SectionHeader title="Company" subtitle="Used on invoices, notification footers and the website contact page." />
          <div className="mt-5 space-y-4">
            <Field label="Company name"><input className="field" value={draft.company} onChange={(e) => set('company', e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Support email"><input className="field" value={draft.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} /></Field>
              <Field label="Phone"><input className="field" value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            </div>
            <Field label="Registered address">
              <textarea className="field min-h-[72px]" value={draft.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="card-pad">
          <SectionHeader title="Shipments" subtitle="How tracking numbers are formed and what proof of delivery must capture." />
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shipment number prefix" hint={'Example: ' + (draft.waybillPrefix || 'PNL') + '104821'}>
                <input className="field font-mono uppercase" maxLength={5} value={draft.waybillPrefix} onChange={(e) => set('waybillPrefix', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Billing currency">
                <input className="field font-mono uppercase" maxLength={3} value={draft.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
              </Field>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ShieldCheck size={13} /> Proof of delivery
              </p>
              <div className="space-y-3">
                <Toggle
                  checked={draft.podRequireSignature}
                  onChange={(v) => set('podRequireSignature', v)}
                  label="Require a signature name"
                  hint="Operators must record who accepted the shipment before it can be marked delivered."
                />
                <Toggle
                  checked={draft.podRequirePhoto}
                  onChange={(v) => set('podRequirePhoto', v)}
                  label="Require photo proof"
                  hint="Planned for the driver application in Phase 2; can be captured manually today."
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-pad">
          <SectionHeader
            title="Website languages"
            subtitle="Visitors can browse in any of these. The brief allows up to six."
            actions={<Badge tone={draft.languages.length >= 6 ? 'amber' : 'slate'}>{draft.languages.length} / 6</Badge>}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {draft.languages.map((l) => (
              <button key={l} onClick={() => toggleLanguage(l)} className="chip border-navy-200 bg-navy-50 text-navy-700 hover:border-navy-400">
                <Languages size={11} /> {l} <X size={11} />
              </button>
            ))}
          </div>
          <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Available</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_POOL.filter((l) => !draft.languages.includes(l)).map((l) => (
              <button
                key={l}
                disabled={draft.languages.length >= 6}
                onClick={() => toggleLanguage(l)}
                className="chip border-slate-200 bg-white text-slate-500 hover:border-navy-300 hover:text-navy-700 disabled:opacity-40"
              >
                <Plus size={11} /> {l}
              </button>
            ))}
          </div>
          {draft.languages.length >= 6 && (
            <p className="mt-3 text-xs text-amber-700">Six languages selected — remove one before adding another.</p>
          )}
        </Card>

        <Card className="card-pad">
          <SectionHeader title="Platform" subtitle="Reference information for this deployment." />
          <dl className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><Building2 size={15} /></span>
              <div>
                <dt className="text-sm font-semibold text-navy-900">Logistics Management Dashboard</dt>
                <dd className="text-xs text-slate-500">Project 2 — secure web-based administration portal.</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><Hash size={15} /></span>
              <div>
                <dt className="text-sm font-semibold text-navy-900">Records held</dt>
                <dd className="text-xs text-slate-500">
                  {db.customers.length} customers · {db.orders.length} orders · {db.invoices.length} invoices · {db.emails.length} notifications
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><Database size={15} /></span>
              <div className="min-w-0">
                <dt className="text-sm font-semibold text-navy-900">Demo dataset</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Changes are stored in this browser. Resetting restores the original seeded operation.
                </dd>
                <button className="btn-ghost btn-sm mt-2 text-red-600" onClick={() => setConfirmReset(true)}>Reset demo data</button>
              </div>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="card-pad mt-5">
        <SectionHeader
          title="Out of scope for this phase"
          subtitle="Captured here so the boundary stays visible to everyone using the dashboard."
        />
        <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li className="flex gap-2"><span className="text-slate-300">—</span> Driver / rider mobile application (Phase 2)</li>
          <li className="flex gap-2"><span className="text-slate-300">—</span> Digital signature capture and photo POD in the field (Phase 2)</li>
          <li className="flex gap-2"><span className="text-slate-300">—</span> QuickBooks / Xero accounting integration (Phase 2)</li>
          <li className="flex gap-2"><span className="text-slate-300">—</span> Ongoing analytics monitoring and reporting (separate engagement)</li>
        </ul>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetData}
        title="Reset demo data?"
        message="Every change — orders, milestones, invoices, content, users and settings — will be replaced with the original seeded dataset."
        confirmLabel="Reset everything"
        danger
      />
    </>
  )
}
