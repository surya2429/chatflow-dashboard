import { useState } from 'react'
import { Zap, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react'
import clsx from 'clsx'
import { NativeSelect } from './Select'
import { CRM_MODULES } from '../constants/crmModules'
import { SOURCE_FIELDS } from '../constants/customFields'
import { MOCK_FLOWS } from '../constants/mockFlows'

const CONDITION_OPERATORS = [
  { v: 'equals', l: 'Equals' },
  { v: 'not_equals', l: 'Not Equals' },
  { v: 'contains', l: 'Contains' },
  { v: 'is_empty', l: 'Is Empty' },
]

const TIMING_OPTIONS = [
  { v: 'immediate', label: 'Trigger immediately when answered', icon: Zap },
  { v: 'on_flow_complete', label: 'Wait until the user completes the whole flow', icon: CheckCircle2 },
  { v: 'delay', label: 'Wait a custom delay after answering', icon: Clock },
]

function MiniToggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={clsx('w-9 h-5 rounded-full flex-shrink-0 transition-colors relative', value ? 'bg-primary' : 'bg-slate-300')}>
      <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all', value ? 'left-[18px]' : 'left-0.5')}/>
    </button>
  )
}

function sourceLabel(row) {
  if (!row) return ''
  if (row.mode === 'fixed') return `Fixed value: "${row.value}"`
  return SOURCE_FIELDS.find(s => s.key === row.value)?.label || row.value
}

function TriggerCard({ trigger, onUpdate, onRemove, moduleMapping }) {
  const [testing, setTesting] = useState(false)
  const [testStage, setTestStage] = useState('')
  const [testResult, setTestResult] = useState(null)

  const flow = MOCK_FLOWS.find(f => f.id === trigger.flowId)
  const mappedForModule = moduleMapping[trigger.module] || {}
  const mappedFieldNames = Object.entries(mappedForModule)
    .filter(([, row]) => row?.mode === 'fixed' ? row?.value?.trim() : row?.value)
    .map(([name]) => name)

  function addCondition() {
    onUpdate(trigger.id, { conditions: [...trigger.conditions, { id: `c${Date.now()}`, column: '', operator: 'equals', value: '' }] })
  }
  function updateCondition(id, patch) {
    onUpdate(trigger.id, { conditions: trigger.conditions.map(c => c.id === id ? { ...c, ...patch } : c) })
  }
  function removeCondition(id) {
    onUpdate(trigger.id, { conditions: trigger.conditions.filter(c => c.id !== id) })
  }

  const canTest = Boolean(trigger.questionId) && mappedFieldNames.length > 0

  function runTest() {
    setTesting(true)
    setTestResult(null)
    setTestStage('Trigger fired — question answered')
    const waitLabel = trigger.timing === 'delay'
      ? `Waiting ${trigger.delayMinutes} min…`
      : trigger.timing === 'on_flow_complete'
        ? 'Waiting for flow to finish…'
        : null
    const afterFire = () => {
      const payload = {}
      mappedFieldNames.forEach(name => { payload[name] = sourceLabel(mappedForModule[name]) || '<empty>' })
      setTesting(false)
      setTestStage('')
      setTestResult({ module: trigger.module, payload })
    }
    if (waitLabel) {
      setTimeout(() => {
        setTestStage(waitLabel)
        setTimeout(afterFire, 700)
      }, 500)
    } else {
      setTimeout(afterFire, 700)
    }
  }

  return (
    <div className="border border-surface-border rounded-xl p-4 space-y-4 bg-white">
      {/* header */}
      <div className="flex items-center gap-2">
        <input type="text" className="input-sm flex-1 font-semibold" value={trigger.name}
          onChange={e => onUpdate(trigger.id, { name: e.target.value })}/>
        <MiniToggle value={trigger.enabled} onChange={v => onUpdate(trigger.id, { enabled: v })}/>
        <button type="button" onClick={() => onRemove(trigger.id)}
          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
          <Trash2 size={14}/>
        </button>
      </div>

      {/* fires when */}
      <div className="space-y-1.5">
        <label className="label mb-0">Fires when this question is answered</label>
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <div className="w-full sm:w-32 flex-shrink-0">
            <NativeSelect sm value={trigger.flowId} onChange={e => onUpdate(trigger.id, { flowId: e.target.value, questionId: '' })}>
              {MOCK_FLOWS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </NativeSelect>
          </div>
          <div className="flex-1 min-w-[140px]">
            <NativeSelect sm value={trigger.questionId} onChange={e => onUpdate(trigger.id, { questionId: e.target.value })}>
              <option value="">Select question…</option>
              {(flow?.questions ?? []).map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
            </NativeSelect>
          </div>
        </div>
        {!trigger.questionId && <p className="text-[10px] text-amber-600">Pick the question that should fire this trigger.</p>}
      </div>

      <div className="divider"/>

      {/* timing */}
      <div className="space-y-1.5">
        <label className="label mb-0">When should it fire?</label>
        <div className="space-y-1.5">
          {TIMING_OPTIONS.map(opt => (
            <label key={opt.v} className={clsx('flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
              trigger.timing === opt.v ? 'border-primary bg-primary-50' : 'border-surface-border hover:bg-surface-hover')}>
              <input type="radio" className="accent-primary" checked={trigger.timing === opt.v}
                onChange={() => onUpdate(trigger.id, { timing: opt.v })}/>
              <opt.icon size={13} className={trigger.timing === opt.v ? 'text-primary' : 'text-slate-400'}/>
              <span className="text-[12px] font-medium text-slate-700 flex-1">{opt.label}</span>
              {opt.v === 'delay' && trigger.timing === 'delay' && (
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <input type="number" min={1} max={120} className="input-sm w-16 text-center"
                    value={trigger.delayMinutes} onChange={e => onUpdate(trigger.id, { delayMinutes: Math.max(1, Number(e.target.value) || 1) })}/>
                  <span className="text-[11px] text-slate-500">min</span>
                </div>
              )}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Matches your previous dashboard's 2-minute wait — now fully adjustable, and "complete the flow" guarantees every later answer is included.</p>
      </div>

      <div className="divider"/>

      {/* CRM module — field mapping is global, configured once in the Field Mapping tab */}
      <div className="space-y-2">
        <label className="label mb-0">Push to CRM module</label>
        <div className="flex gap-1.5 flex-wrap">
          {CRM_MODULES.map(mod => (
            <button key={mod} type="button" onClick={() => onUpdate(trigger.id, { module: mod })}
              className={clsx('px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors',
                trigger.module === mod ? 'border-primary bg-primary-50 text-primary' : 'border-surface-border bg-white text-slate-600 hover:bg-surface-hover')}>
              {mod}
            </button>
          ))}
        </div>
      </div>

      <div className="divider"/>

      {/* conditions */}
      <div className="space-y-2">
        <label className="label mb-0">Only fire if… <span className="text-slate-400 font-normal">(Optional)</span></label>
        <div className="space-y-1.5">
          {trigger.conditions.map((c, i) => (
            <div key={c.id}>
              {i > 0 && (
                <div className="my-1.5">
                  <NativeSelect sm className="w-20" value={trigger.logicOp} onChange={e => onUpdate(trigger.id, { logicOp: e.target.value })}>
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </NativeSelect>
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-surface-border flex-1 min-w-[110px]">
                  <select className="flex-1 bg-transparent text-[11px] font-medium text-slate-700 outline-none" value={c.column} onChange={e => updateCondition(c.id, { column: e.target.value })}>
                    <option value="">Field…</option>
                    {SOURCE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div className="w-28 flex-shrink-0">
                  <NativeSelect sm value={c.operator} onChange={e => updateCondition(c.id, { operator: e.target.value })}>
                    {CONDITION_OPERATORS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </NativeSelect>
                </div>
                {c.operator !== 'is_empty' && (
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-surface-border flex-1 min-w-[100px]">
                    <input type="text" className="flex-1 bg-transparent text-[11px] outline-none" placeholder="Value" value={c.value} onChange={e => updateCondition(c.id, { value: e.target.value })}/>
                  </div>
                )}
                <button type="button" onClick={() => removeCondition(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCondition} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
          <Plus size={12}/> Add Condition
        </button>
      </div>

      <div className="divider"/>

      {/* test */}
      <div className="space-y-2">
        <button type="button" onClick={runTest} disabled={testing || !canTest} className="btn-secondary">
          {testing ? <><span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/> {testStage || 'Testing…'}</> : <><Zap size={12}/> Test this trigger</>}
        </button>
        {!canTest && <p className="text-[10px] text-slate-400">Pick a question and map at least one field for {trigger.module} to test.</p>}
        {testResult && (
          <div className="rounded-lg bg-slate-900 p-3 overflow-x-auto">
            <p className="text-[10px] text-emerald-400 font-semibold mb-1">Pushed to {testResult.module} ✓</p>
            <pre className="text-[10px] text-slate-200 font-mono whitespace-pre-wrap">{JSON.stringify(testResult.payload, null, 2)}</pre>
          </div>
        )}
      </div>

      <p className={clsx('text-[11px] font-medium flex items-center gap-1.5', trigger.enabled ? 'text-emerald-600' : 'text-slate-400')}>
        <span className={clsx('w-1.5 h-1.5 rounded-full', trigger.enabled ? 'bg-emerald-500' : 'bg-slate-300')}/>
        {trigger.enabled ? 'Active — will fire on next matching answer' : 'Disabled — won\'t fire'}
      </p>
    </div>
  )
}

export default function CrmTriggersSection({ triggers, onChange, savedFlash, moduleMapping }) {
  function addTrigger() {
    onChange(prev => [...prev, {
      id: `tr${Date.now()}`, name: `Trigger ${prev.length + 1}`, enabled: true,
      flowId: 'main', questionId: '', timing: 'delay', delayMinutes: 2,
      module: CRM_MODULES[0], conditions: [], logicOp: 'AND',
    }])
  }
  function updateTrigger(id, patch) {
    onChange(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  function removeTrigger(id) {
    onChange(prev => prev.filter(t => t.id !== id))
  }

  if (triggers.length === 0) {
    return (
      <div className="text-center py-14 border border-dashed border-surface-border rounded-xl">
        <Zap size={22} className="text-slate-300 mx-auto mb-2"/>
        <p className="text-[12px] font-semibold text-slate-600">No triggers configured yet</p>
        <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Add a trigger to push flow answers into a CRM module automatically.</p>
        <button type="button" onClick={addTrigger} className="btn-primary">
          <Plus size={13}/> Add Trigger
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720 }} className="space-y-3">
      {triggers.map(t => (
        <TriggerCard key={t.id} trigger={t} onUpdate={updateTrigger} onRemove={removeTrigger}
          moduleMapping={moduleMapping}/>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={addTrigger} className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
          <Plus size={12}/> Add Trigger
        </button>
        {savedFlash && <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1"><CheckCircle2 size={12}/> Saved</span>}
      </div>
    </div>
  )
}
