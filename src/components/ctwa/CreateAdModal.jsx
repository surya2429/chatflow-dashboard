import { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, Rocket, Upload, X, CheckCircle2, Users } from 'lucide-react'
import clsx from 'clsx'
import { ctwa, money } from '../../lib/ctwaApi'
import AdPreview from './AdPreview'
import { Banner, btnGhostXl, btnPrimaryXl, Field, inputCls, Modal, microLabel } from './ui'

const STEPS = ['Campaign', 'Audience', 'Creative', 'Review']
const STEP_OF = { name: 0, dailyBudget: 0, startTime: 0, endTime: 0, countries: 1, age: 1, primaryText: 2, headline: 2, image: 2, greeting: 2, autofillMessage: 2, iceBreakers: 2 }
const OBJECTIVES = [
  ['OUTCOME_ENGAGEMENT', 'Messages', 'Get people to start a WhatsApp chat. Best for most businesses.'],
  ['OUTCOME_LEADS', 'Leads', 'Collect enquiries and contact details through the chat.'],
  ['OUTCOME_SALES', 'Sales', 'Drive purchases and orders handled over WhatsApp.'],
  ['OUTCOME_TRAFFIC', 'Traffic', 'Send more people into a WhatsApp conversation.'],
]
const COUNTRIES = [['IN', 'India'], ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['SG', 'Singapore'], ['MY', 'Malaysia'], ['ID', 'Indonesia'], ['PH', 'Philippines'], ['BD', 'Bangladesh'], ['PK', 'Pakistan'], ['LK', 'Sri Lanka'], ['NP', 'Nepal'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['EG', 'Egypt'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['CO', 'Colombia'], ['AR', 'Argentina'], ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['TR', 'Türkiye'], ['QA', 'Qatar'], ['KW', 'Kuwait'], ['OM', 'Oman']]
const nameOf = Object.fromEntries(COUNTRIES)
const INITIAL = {
  name: '', objective: 'OUTCOME_ENGAGEMENT', dailyBudget: '500', startTime: '', endTime: '',
  countries: ['IN'], ageMin: 18, ageMax: 65, genders: 'all',
  primaryText: '', headline: '', description: '', imageMode: 'url', imageUrl: '', imageData: '', imageName: '',
  welcomeType: 'autofill', greeting: 'Hi 👋 Thanks for your interest! How can we help?', autofillMessage: 'Hi, I saw your ad and I’d like to know more.', iceBreakers: ['', '', ''],
  status: 'PAUSED',
}
const MAX_IMAGE = 4 * 1024 * 1024

const Seg = ({ options, value, onChange }) => (
  <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
    {options.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', value === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{l}</button>)}
  </div>
)

/** Create a Click-to-WhatsApp ad: four steps in the same modal Broadcasting uses for campaigns, with the live preview beside it. */
export default function CreateAdModal({ data, onClose, onCreated, notify }) {
  const currency = data?.currency ?? 'INR'
  const [step, setStep] = useState(0)
  const [f, setF] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [search, setSearch] = useState('')
  const file = useRef(null)
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => { const { [k]: _x, ...rest } = e; return rest }) }

  const welcome = { type: f.welcomeType, greeting: f.greeting, autofillMessage: f.autofillMessage, iceBreakers: f.iceBreakers }
  const image = f.imageMode === 'upload' ? f.imageData : f.imageUrl
  const matches = useMemo(() => COUNTRIES.filter(([c, n]) => !f.countries.includes(c) && (n.toLowerCase().includes(search.toLowerCase()) || c.toLowerCase() === search.toLowerCase())).slice(0, 8), [search, f.countries])

  function pickFile(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (!picked.type.startsWith('image/')) return setErrors((x) => ({ ...x, image: 'Choose an image file (JPG or PNG).' }))
    if (picked.size > MAX_IMAGE) return setErrors((x) => ({ ...x, image: 'The image must be under 4 MB.' }))
    const r = new FileReader()
    r.onload = () => { setF((s) => ({ ...s, imageData: String(r.result), imageName: picked.name })); setErrors((x) => { const { image: _i, ...rest } = x; return rest }) }
    r.readAsDataURL(picked)
  }

  // the same rules the server enforces, so mistakes show up while typing, not after publishing
  function check(s) {
    const e = {}
    if (s === 0) {
      if (f.name.trim().length < 2) e.name = 'Give the ad a name (at least 2 characters).'
      if (!(Number(f.dailyBudget) > 0)) e.dailyBudget = 'Enter a daily budget above 0.'
      if (f.startTime && f.endTime && new Date(f.endTime) - new Date(f.startTime) < 86400000) e.endTime = 'The ad must run for more than 24 hours.'
    }
    if (s === 1) {
      if (!f.countries.length) e.countries = 'Pick at least one country.'
      if (!(f.ageMin >= 13 && f.ageMax <= 65 && f.ageMin <= f.ageMax)) e.age = 'Choose an age range between 13 and 65.'
    }
    if (s === 2) {
      if (!f.primaryText.trim()) e.primaryText = 'Write the main text people see above the image.'
      if (!f.headline.trim()) e.headline = 'Write a headline.'
      if (!image) e.image = 'Add an image.'
      else if (f.imageMode === 'url' && !/^https:\/\/\S+$/i.test(f.imageUrl.trim())) e.image = 'The image link must start with https://'
      if (!f.greeting.trim()) e.greeting = 'Write the greeting people see when the chat opens.'
      if (f.welcomeType === 'autofill' && !f.autofillMessage.trim()) e.autofillMessage = 'Write the pre-filled message.'
      if (f.welcomeType === 'ice_breakers' && !f.iceBreakers.some((x) => x.trim())) e.iceBreakers = 'Add at least one question.'
    }
    return e
  }
  function next() { const e = check(step); setErrors(e); if (!Object.keys(e).length) setStep(step + 1) }

  async function publish() {
    const all = [0, 1, 2].reduce((acc, s) => ({ ...acc, ...check(s) }), {})
    if (Object.keys(all).length) { setErrors(all); return setStep(Math.min(...Object.keys(all).map((k) => STEP_OF[k] ?? 0))) }
    setBusy(true)
    try {
      const res = await ctwa.createAd({
        name: f.name, objective: f.objective, dailyBudget: Number(f.dailyBudget),
        startTime: f.startTime ? new Date(f.startTime).toISOString() : null, endTime: f.endTime ? new Date(f.endTime).toISOString() : null,
        targeting: { countries: f.countries, ageMin: Number(f.ageMin), ageMax: Number(f.ageMax), genders: f.genders },
        creative: {
          primaryText: f.primaryText, headline: f.headline, description: f.description,
          imageUrl: f.imageMode === 'url' ? f.imageUrl.trim() : null, imageBase64: f.imageMode === 'upload' ? f.imageData : null,
          welcome: f.welcomeType === 'autofill' ? { type: 'autofill', greeting: f.greeting, autofillMessage: f.autofillMessage } : { type: 'ice_breakers', greeting: f.greeting, iceBreakers: f.iceBreakers },
        },
        status: f.status,
      })
      setDone({ ...res, published: f.status === 'ACTIVE', mode: data?.mode })
      notify(`“${f.name}” was created.`, 'ok')
    } catch (e) {
      if (e.fields) { setErrors(e.fields); setStep(Math.min(...Object.keys(e.fields).map((k) => STEP_OF[k] ?? 0))) }
      setErrors((x) => ({ ...x, _form: e.message }))
    } finally { setBusy(false) }
  }

  const stepper = (
    <div className="flex items-center px-6 py-3.5 border-b border-surface-border bg-slate-50/50 flex-shrink-0">
      {STEPS.map((s, i) => {
        const complete = i < step, current = i === step
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0', complete ? 'bg-primary text-white' : current ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-slate-100 text-slate-400')}>{complete ? <Check size={11} /> : i + 1}</div>
              <span className={clsx('text-[11px] font-semibold hidden sm:block', current ? 'text-slate-900' : complete ? 'text-slate-500' : 'text-slate-400')}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={clsx('flex-1 h-px mx-2 transition-all', i < step ? 'bg-primary' : 'bg-slate-200')} />}
          </div>
        )
      })}
    </div>
  )

  if (done) {
    return (
      <Modal title="Create Click-to-WhatsApp Ad" size="max-w-3xl" onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4"><CheckCircle2 size={28} className="text-emerald-500" /></div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Ad Created!</h3>
          <p className="text-sm text-slate-500 max-w-md">
            {done.published ? 'It was sent to Meta for review and starts delivering once approved.' : 'It was saved as paused, so nothing is spent yet. Turn it on from the Ads list when you are ready.'}
            {done.mode === 'sample' && ' (Sample mode: nothing was sent to Meta.)'}
          </p>
          <p className="text-[11px] text-slate-400 mt-3 font-mono">Ad ID {done.adId}</p>
          <div className="flex gap-2.5 mt-6">
            <button onClick={() => { setF(INITIAL); setStep(0); setDone(null) }} className={btnGhostXl}>Create another</button>
            <button onClick={() => onCreated(done.adId)} className={btnPrimaryXl}>View my ad</button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Create Click-to-WhatsApp Ad" sub={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`} size="max-w-4xl" onClose={onClose} belowHeader={stepper}
      footer={<>
        <div className="text-xs text-slate-400"><span className="flex items-center gap-1.5 text-slate-500"><Users size={12} />{f.countries.map((c) => nameOf[c] || c).slice(0, 2).join(', ')}{f.countries.length > 2 && ` +${f.countries.length - 2}`} · {money(Number(f.dailyBudget) || 0, currency)}/day</span></div>
        <div className="flex items-center gap-2.5">
          <button onClick={onClose} className={btnGhostXl}>Cancel</button>
          {step > 0 && <button onClick={() => setStep(step - 1)} className={btnGhostXl}><ChevronLeft size={13} /> Back</button>}
          {step < STEPS.length - 1
            ? <button onClick={next} className={btnPrimaryXl}>Continue <ChevronRight size={13} /></button>
            : <button onClick={publish} disabled={busy} className={btnPrimaryXl}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} {busy ? 'Creating…' : f.status === 'ACTIVE' ? 'Create & Publish' : 'Create Ad'}</button>}
        </div>
      </>}>
      <div className="flex" style={{ minHeight: 420 }}>
        <div className="flex-1 min-w-0 p-6 space-y-5">
          {errors._form && <Banner tone="error">{errors._form}</Banner>}

          {step === 0 && (
            <>
              <Field label="Ad name" error={errors.name} hint="Only you see this. It names the campaign, ad set and ad in Meta.">
                <input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={100} placeholder="e.g. Diwali Offer — carousel" className={inputCls} autoFocus />
              </Field>
              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">What do you want from this ad?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OBJECTIVES.map(([k, t, d]) => (
                    <button key={k} onClick={() => set('objective', k)} aria-pressed={f.objective === k} className={clsx('text-left rounded-xl border px-3.5 py-3 transition-all', f.objective === k ? 'border-primary bg-primary-50/50 ring-2 ring-primary/10' : 'border-surface-border hover:border-slate-300')}>
                      <p className="text-xs font-bold text-slate-800">{t}</p><p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">{d}</p>
                    </button>
                  ))}
                </div>
              </div>
              <Field label={`Daily budget (${currency})`} error={errors.dailyBudget} hint="The most you want to spend per day. Meta spreads it across the day and enforces its own minimum.">
                <input type="number" min="1" value={f.dailyBudget} onChange={(e) => set('dailyBudget', e.target.value)} className={clsx(inputCls, 'max-w-[200px]')} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Start" hint="Leave empty to start as soon as you turn it on."><input type="datetime-local" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} className={inputCls} /></Field>
                <Field label="End" error={errors.endTime} hint="Leave empty to run until you stop it."><input type="datetime-local" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} className={inputCls} /></Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Where should people see it?" error={errors.countries}>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {f.countries.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary-50 text-primary text-[11px] font-semibold">{nameOf[c] || c}
                      <button onClick={() => set('countries', f.countries.filter((x) => x !== c))} aria-label={`Remove ${nameOf[c] || c}`} className="p-0.5 rounded-full hover:bg-primary/10"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a country to add" aria-label="Search countries" className={inputCls} />
                {search && <div className="flex flex-wrap gap-1.5 mt-2">
                  {matches.map(([c, n]) => <button key={c} onClick={() => { set('countries', [...f.countries, c].slice(0, 25)); setSearch('') }} className="px-2.5 py-1 rounded-full border border-surface-border text-[11px] text-slate-600 hover:border-primary hover:text-primary">+ {n}</button>)}
                  {!matches.length && <span className="text-[11px] text-slate-400">No match.</span>}
                </div>}
              </Field>
              <Field label="Age" error={errors.age}>
                <div className="flex items-center gap-2">
                  <input type="number" min="13" max="65" value={f.ageMin} onChange={(e) => set('ageMin', e.target.value)} aria-label="Minimum age" className={clsx(inputCls, 'w-20')} />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="number" min="13" max="65" value={f.ageMax} onChange={(e) => set('ageMax', e.target.value)} aria-label="Maximum age" className={clsx(inputCls, 'w-20')} />
                </div>
              </Field>
              <Field label="Gender"><Seg value={f.genders} onChange={(v) => set('genders', v)} options={[['all', 'All'], ['female', 'Women'], ['male', 'Men']]} /></Field>
              <p className="text-[10.5px] text-slate-400">Placements are automatic: Meta shows the ad on Facebook and Instagram wherever it performs best.</p>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Main text" error={errors.primaryText} hint={`${f.primaryText.length}/500 · shown above the image`}>
                <textarea rows={3} value={f.primaryText} onChange={(e) => set('primaryText', e.target.value.slice(0, 500))} placeholder="Tell people what you offer and why to message you." className={clsx(inputCls, 'resize-none')} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Headline" error={errors.headline} hint={`${f.headline.length}/60`}><input value={f.headline} onChange={(e) => set('headline', e.target.value.slice(0, 60))} className={inputCls} /></Field>
                <Field label="Description (optional)" hint={`${f.description.length}/90`}><input value={f.description} onChange={(e) => set('description', e.target.value.slice(0, 90))} className={inputCls} /></Field>
              </div>
              <Field label="Image" error={errors.image} hint="A square or 1.91:1 picture works best. JPG or PNG, under 4 MB.">
                <div className="mb-2"><Seg value={f.imageMode} onChange={(v) => set('imageMode', v)} options={[['url', 'Image link'], ['upload', 'Upload']]} /></div>
                {f.imageMode === 'url' ? (
                  <input value={f.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…/offer.jpg" className={inputCls} />
                ) : (
                  <div className="flex items-center gap-3">
                    <input ref={file} type="file" accept="image/*" onChange={pickFile} className="hidden" aria-label="Upload image" />
                    <button onClick={() => file.current?.click()} className={btnGhostXl}><Upload size={13} /> {f.imageName ? 'Replace image' : 'Choose image'}</button>
                    {f.imageName && <span className="text-[11px] text-slate-500 truncate">{f.imageName}</span>}
                  </div>
                )}
              </Field>
              <div className="rounded-xl border border-surface-border overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-surface-border"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Welcome message</span><p className="text-[10.5px] text-slate-400 mt-0.5">What Meta shows inside WhatsApp, before they send anything.</p></div>
                <div className="p-4 space-y-3">
                  <Field label="Greeting" error={errors.greeting} hint={`${f.greeting.length}/80`}><input value={f.greeting} onChange={(e) => set('greeting', e.target.value.slice(0, 80))} className={inputCls} /></Field>
                  <Seg value={f.welcomeType} onChange={(v) => set('welcomeType', v)} options={[['autofill', 'Pre-filled message'], ['ice_breakers', 'Ice breakers']]} />
                  {f.welcomeType === 'autofill' ? (
                    <Field label="Message the customer sends" error={errors.autofillMessage} hint="Already typed in their message box; they only tap send. Your bot can reply to it.">
                      <textarea rows={2} value={f.autofillMessage} onChange={(e) => set('autofillMessage', e.target.value.slice(0, 1000))} className={clsx(inputCls, 'resize-none')} />
                    </Field>
                  ) : (
                    <Field label="Ice breakers" error={errors.iceBreakers} hint="Up to 3 questions the customer can tap to start the chat.">
                      <div className="space-y-2">{f.iceBreakers.map((v, i) => <input key={i} value={v} maxLength={80} onChange={(e) => set('iceBreakers', f.iceBreakers.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Question ${i + 1}`} aria-label={`Ice breaker ${i + 1}`} className={inputCls} />)}</div>
                    </Field>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
                {[
                  ['Ad name', f.name], ['Goal', OBJECTIVES.find((o) => o[0] === f.objective)[1]],
                  ['Daily budget', money(Number(f.dailyBudget), currency)], ['Schedule', `${f.startTime ? new Date(f.startTime).toLocaleString() : 'When turned on'} → ${f.endTime ? new Date(f.endTime).toLocaleString() : 'No end date'}`],
                  ['Countries', f.countries.map((c) => nameOf[c] || c).join(', ')], ['Age & gender', `${f.ageMin}–${f.ageMax} · ${f.genders === 'all' ? 'everyone' : f.genders === 'male' ? 'men' : 'women'}`],
                  ['Headline', f.headline], ['Welcome', f.welcomeType === 'autofill' ? 'Pre-filled message' : `${f.iceBreakers.filter((x) => x.trim()).length} ice breakers`],
                ].map(([k, v]) => <div key={k}><dt className={microLabel}>{k}</dt><dd className="font-semibold text-slate-800 mt-1 break-words">{v}</dd></div>)}
              </dl>
              <fieldset className="space-y-2">
                <legend className={clsx(microLabel, 'mb-2')}>When should it start?</legend>
                {[['PAUSED', 'Save as paused (recommended)', 'Nothing is spent until you turn it on from the Ads list.'], ['ACTIVE', 'Publish now', 'Goes to Meta for review and starts spending your budget once approved.']].map(([k, t, d]) => (
                  <label key={k} className={clsx('flex gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition-all', f.status === k ? 'border-primary bg-primary-50/50 ring-2 ring-primary/10' : 'border-surface-border')}>
                    <input type="radio" name="status" checked={f.status === k} onChange={() => set('status', k)} className="mt-0.5 accent-primary" />
                    <span><span className="block text-xs font-bold text-slate-800">{t}</span><span className="block text-[10.5px] text-slate-500 mt-0.5">{d}</span></span>
                  </label>
                ))}
              </fieldset>
              {data?.mode === 'sample' && <Banner tone="info">Sample mode: this creates a practice ad in the dashboard only. Connect your Facebook ads account in Setup to create real ads.</Banner>}
            </>
          )}
        </div>

        <div className="w-[340px] flex-shrink-0 p-5 bg-slate-50 border-l border-surface-border hidden md:block">
          <p className={clsx(microLabel, 'mb-4')}>Ad Preview</p>
          <AdPreview pageName={data?.pageName} headline={f.headline} primaryText={f.primaryText} description={f.description} imageUrl={image} welcome={welcome} />
        </div>
      </div>
    </Modal>
  )
}
