import { useMemo, useState } from 'react'
import {
  Globe2, FileText, HelpCircle, Upload, Plus, Pencil, Trash2, Eye, EyeOff, Truck, Search,
} from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { fmtDate, fmtNum } from '../lib/format'
import {
  Card, PageHeader, Tabs, Table, SearchInput, Modal, Field, Select, Toggle,
  ConfirmDialog, EmptyState, Badge, SectionHeader,
} from '../components/ui'
import { ContentBadge } from '../components/StatusBadge'

const emptyPage = { title: '', slug: '', type: 'page', status: 'draft', excerpt: '', seoTitle: '', seoDescription: '' }
const emptyBlog = { title: '', slug: '', author: '', status: 'draft', excerpt: '', tags: [], views: 0 }
const emptyFaq = { question: '', answer: '', category: 'Tracking', status: 'draft', order: 99 }

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/* ── Editors ───────────────────────────────────────────────────────────────── */

function PageEditor({ open, onClose, item, onSave, serviceOnly }) {
  const [f, setF] = useState(item || { ...emptyPage, type: serviceOnly ? 'service' : 'page' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose}
      title={item ? 'Edit page' : serviceOnly ? 'New service page' : 'New website page'}
      subtitle="Content and SEO metadata published to the public website."
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.title.trim()} onClick={() => { onSave({ ...f, slug: f.slug || slugify(f.title) }); onClose() }}>Save page</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page title"><input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="URL slug" hint={'/' + (f.slug || slugify(f.title) || '…')}>
            <input className="field font-mono text-xs" value={f.slug} onChange={(e) => set('slug', slugify(e.target.value))} />
          </Field>
        </div>
        <Field label="Summary">
          <textarea className="field min-h-[80px]" value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
        </Field>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Search size={13} /> SEO
          </p>
          <div className="space-y-3">
            <Field label="Meta title"><input className="field" value={f.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} /></Field>
            <Field label="Meta description" hint={(f.seoDescription || '').length + ' / 160 characters'}>
              <textarea className="field min-h-[64px]" maxLength={160} value={f.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} />
            </Field>
          </div>
        </div>
        <Toggle checked={f.status === 'published'} onChange={(v) => set('status', v ? 'published' : 'draft')} label="Published" hint="Draft pages are hidden from the live website." />
      </div>
    </Modal>
  )
}

function BlogEditor({ open, onClose, item, onSave, author }) {
  const [f, setF] = useState(item || { ...emptyBlog, author })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose}
      title={item ? 'Edit article' : 'New blog article'}
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.title.trim()} onClick={() => { onSave({ ...f, slug: f.slug || slugify(f.title) }); onClose() }}>Save article</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Headline"><input className="field" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Author"><input className="field" value={f.author} onChange={(e) => set('author', e.target.value)} /></Field>
          <Field label="Tags" hint="Comma separated">
            <input className="field" value={(f.tags || []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
          </Field>
        </div>
        <Field label="Excerpt">
          <textarea className="field min-h-[96px]" value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
        </Field>
        <Toggle checked={f.status === 'published'} onChange={(v) => set('status', v ? 'published' : 'draft')} label="Published" />
      </div>
    </Modal>
  )
}

function FaqEditor({ open, onClose, item, onSave }) {
  const [f, setF] = useState(item || emptyFaq)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  return (
    <Modal
      open={open} onClose={onClose}
      title={item ? 'Edit FAQ' : 'New FAQ'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.question.trim()} onClick={() => { onSave(f); onClose() }}>Save FAQ</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Question"><input className="field" value={f.question} onChange={(e) => set('question', e.target.value)} /></Field>
        <Field label="Answer"><textarea className="field min-h-[110px]" value={f.answer} onChange={(e) => set('answer', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={f.category} onChange={(v) => set('category', v)} options={['Tracking', 'Booking', 'Billing', 'Coverage', 'Compliance'].map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Display order"><input type="number" className="field tnum" value={f.order} onChange={(e) => set('order', Number(e.target.value))} /></Field>
        </div>
        <Toggle checked={f.status === 'published'} onChange={(v) => set('status', v ? 'published' : 'draft')} label="Published" />
      </div>
    </Modal>
  )
}

function UploadModal({ open, onClose, onSave }) {
  const [f, setF] = useState({ name: '', category: 'Guides', size: '256 KB', public: true })
  return (
    <Modal
      open={open} onClose={onClose}
      title="Upload a document"
      subtitle="Rate cards, compliance sheets and templates linked from the website."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.name.trim()} onClick={() => { onSave(f); onClose() }}><Upload size={15} /> Upload</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="File name" hint="Include the extension, e.g. rate-card-2026.pdf">
          <input className="field" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={f.category} onChange={(v) => setF((s) => ({ ...s, category: v }))} options={['Rate cards', 'Compliance', 'Templates', 'Contracts', 'Guides', 'Marketing'].map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Size"><input className="field" value={f.size} onChange={(e) => setF((s) => ({ ...s, size: e.target.value }))} /></Field>
        </div>
        <Toggle checked={f.public} onChange={(v) => setF((s) => ({ ...s, public: v }))} label="Publicly downloadable" hint="Private files are available to staff only." />
      </div>
    </Modal>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function Content() {
  const { db, saveContent, deleteContent, uploadDocument } = useData()
  const { user } = useAuth()
  const [tab, setTab] = useState('pages')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)   // { bucket, item|null }
  const [confirm, setConfirm] = useState(null)   // { bucket, id, label }

  const { pages, blogs, faqs, documents } = db.content
  const sitePages = useMemo(() => pages.filter((p) => p.type === 'page'), [pages])
  const servicePages = useMemo(() => pages.filter((p) => p.type === 'service'), [pages])

  const filter = (list, keys) => {
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter((x) => keys.some((k) => String(x[k] || '').toLowerCase().includes(term)))
  }

  const tabs = [
    { id: 'pages', label: 'Website pages', count: sitePages.length },
    { id: 'services', label: 'Service pages', count: servicePages.length },
    { id: 'blogs', label: 'Blog', count: blogs.length },
    { id: 'faqs', label: 'FAQs', count: faqs.length },
    { id: 'documents', label: 'Documents', count: documents.length },
  ]

  const newAction = () => {
    if (tab === 'pages') setEditing({ bucket: 'pages', item: null })
    else if (tab === 'services') setEditing({ bucket: 'pages', item: null, serviceOnly: true })
    else if (tab === 'blogs') setEditing({ bucket: 'blogs', item: null })
    else if (tab === 'faqs') setEditing({ bucket: 'faqs', item: null })
    else setEditing({ bucket: 'documents', item: null })
  }

  const newLabel = { pages: 'New page', services: 'New service page', blogs: 'New article', faqs: 'New FAQ', documents: 'Upload document' }[tab]

  return (
    <>
      <PageHeader
        title="Content Management"
        subtitle="Everything published on the Prime Next Logistics website — corporate pages, service pages, blog, FAQs and downloadable documents."
        actions={
          <button className="btn-primary" onClick={newAction}>
            {tab === 'documents' ? <Upload size={16} /> : <Plus size={16} />} {newLabel}
          </button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search content…" className="min-w-[240px] max-w-sm flex-1" />
        </div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} className="px-2" />

        {(tab === 'pages' || tab === 'services') && (
          <Table
            head={[
              { key: 't', label: tab === 'services' ? 'Service page' : 'Page' },
              { key: 's', label: 'URL' }, { key: 'seo', label: 'SEO title' },
              { key: 'st', label: 'Status' }, { key: 'u', label: 'Last updated' }, { key: 'a', label: '' },
            ]}
            empty={filter(tab === 'services' ? servicePages : sitePages, ['title', 'slug']).length === 0}
            emptyLabel="No pages match this search"
          >
            {filter(tab === 'services' ? servicePages : sitePages, ['title', 'slug']).map((p) => (
              <tr key={p.id}>
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <span className={'grid h-7 w-7 shrink-0 place-items-center rounded-md ' + (p.type === 'service' ? 'bg-amber-100 text-amber-700' : 'bg-navy-100 text-navy-700')}>
                      {p.type === 'service' ? <Truck size={14} /> : <Globe2 size={14} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900">{p.title}</p>
                      <p className="truncate text-[11px] text-slate-400">{p.excerpt}</p>
                    </div>
                  </div>
                </td>
                <td className="td font-mono text-xs text-slate-500">/{p.slug}</td>
                <td className="td max-w-[220px] truncate text-slate-600">{p.seoTitle}</td>
                <td className="td"><ContentBadge status={p.status} /></td>
                <td className="td whitespace-nowrap text-slate-600">{fmtDate(p.updatedAt)}<p className="text-[11px] text-slate-400">by {p.updatedBy}</p></td>
                <td className="td text-right">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing({ bucket: 'pages', item: p, serviceOnly: p.type === 'service' })}><Pencil size={13} /></button>
                    <button
                      className="btn-ghost btn-sm"
                      title={p.status === 'published' ? 'Unpublish' : 'Publish'}
                      onClick={() => saveContent('pages', { ...p, status: p.status === 'published' ? 'draft' : 'published' }, user.name)}
                    >
                      {p.status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => setConfirm({ bucket: 'pages', id: p.id, label: p.title })}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === 'blogs' && (
          <Table
            head={[{ key: 't', label: 'Article' }, { key: 'a', label: 'Author' }, { key: 'tag', label: 'Tags' }, { key: 'v', label: 'Views', align: 'right' }, { key: 'st', label: 'Status' }, { key: 'u', label: 'Updated' }, { key: 'x', label: '' }]}
            empty={filter(blogs, ['title', 'author']).length === 0}
            emptyLabel="No articles match this search"
          >
            {filter(blogs, ['title', 'author']).map((b) => (
              <tr key={b.id}>
                <td className="td">
                  <p className="font-semibold text-navy-900">{b.title}</p>
                  <p className="truncate text-[11px] text-slate-400">/{b.slug}</p>
                </td>
                <td className="td whitespace-nowrap text-slate-600">{b.author}</td>
                <td className="td">
                  <div className="flex flex-wrap gap-1">{(b.tags || []).map((t) => <Badge key={t} tone="slate">{t}</Badge>)}</div>
                </td>
                <td className="td text-right tnum text-slate-600">{fmtNum(b.views)}</td>
                <td className="td"><ContentBadge status={b.status} /></td>
                <td className="td whitespace-nowrap text-slate-600">{fmtDate(b.updatedAt)}</td>
                <td className="td text-right">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing({ bucket: 'blogs', item: b })}><Pencil size={13} /></button>
                    <button className="btn-ghost btn-sm" onClick={() => saveContent('blogs', { ...b, status: b.status === 'published' ? 'draft' : 'published' }, user.name)}>
                      {b.status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button className="btn-ghost btn-sm text-red-600" onClick={() => setConfirm({ bucket: 'blogs', id: b.id, label: b.title })}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === 'faqs' && (
          <div className="divide-y divide-slate-100">
            {filter(faqs, ['question', 'answer', 'category']).length === 0 ? (
              <div className="p-12"><EmptyState icon={HelpCircle} label="No FAQs match this search" /></div>
            ) : filter(faqs, ['question', 'answer', 'category']).map((f) => (
              <div key={f.id} className="flex items-start gap-4 p-5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600"><HelpCircle size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-navy-900">{f.question}</p>
                    <ContentBadge status={f.status} />
                    <Badge tone="slate">{f.category}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.answer}</p>
                  <p className="mt-2 text-[11px] text-slate-400">Updated {fmtDate(f.updatedAt)} by {f.updatedBy}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ bucket: 'faqs', item: f })}><Pencil size={13} /></button>
                  <button className="btn-ghost btn-sm" onClick={() => saveContent('faqs', { ...f, status: f.status === 'published' ? 'draft' : 'published' }, user.name)}>
                    {f.status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button className="btn-ghost btn-sm text-red-600" onClick={() => setConfirm({ bucket: 'faqs', id: f.id, label: f.question })}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'documents' && (
          <Table
            head={[{ key: 'n', label: 'Document' }, { key: 'c', label: 'Category' }, { key: 's', label: 'Size' }, { key: 'v', label: 'Visibility' }, { key: 'u', label: 'Uploaded' }, { key: 'a', label: '' }]}
            empty={filter(documents, ['name', 'category']).length === 0}
            emptyLabel="No documents uploaded"
          >
            {filter(documents, ['name', 'category']).map((d) => (
              <tr key={d.id}>
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500"><FileText size={14} /></span>
                    <span className="font-medium text-navy-900">{d.name}</span>
                  </div>
                </td>
                <td className="td"><Badge tone="slate">{d.category}</Badge></td>
                <td className="td whitespace-nowrap text-slate-600">{d.size}</td>
                <td className="td">{d.public ? <Badge tone="green" dot>Public</Badge> : <Badge tone="amber" dot>Staff only</Badge>}</td>
                <td className="td whitespace-nowrap text-slate-600">{fmtDate(d.uploadedAt)}<p className="text-[11px] text-slate-400">by {d.uploadedBy}</p></td>
                <td className="td text-right">
                  <button className="btn-ghost btn-sm text-red-600" onClick={() => setConfirm({ bucket: 'documents', id: d.id, label: d.name })}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="card-pad mt-5">
        <SectionHeader
          title="Publishing note"
          subtitle="Draft items stay hidden from the public website until published. SEO metadata on each page feeds the site's meta tags and sitemap."
        />
      </Card>

      {editing && editing.bucket === 'pages' && (
        <PageEditor
          open onClose={() => setEditing(null)} item={editing.item} serviceOnly={editing.serviceOnly}
          onSave={(item) => saveContent('pages', { ...item, type: editing.serviceOnly ? 'service' : item.type || 'page' }, user.name)}
        />
      )}
      {editing && editing.bucket === 'blogs' && (
        <BlogEditor open onClose={() => setEditing(null)} item={editing.item} author={user.name} onSave={(item) => saveContent('blogs', item, user.name)} />
      )}
      {editing && editing.bucket === 'faqs' && (
        <FaqEditor open onClose={() => setEditing(null)} item={editing.item} onSave={(item) => saveContent('faqs', item, user.name)} />
      )}
      {editing && editing.bucket === 'documents' && (
        <UploadModal open onClose={() => setEditing(null)} onSave={(doc) => uploadDocument(doc, user.name)} />
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteContent(confirm.bucket, confirm.id, user.name)}
        title="Delete this item?"
        message={confirm ? '“' + confirm.label + '” will be removed from the website. This cannot be undone.' : ''}
        confirmLabel="Delete"
        danger
      />
    </>
  )
}
