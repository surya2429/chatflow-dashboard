import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  Building2, Search, Download, ArrowRight, MoreVertical, ChevronRight,
  Check, LayoutList, LayoutGrid, Table2, ChevronDown,
  AlertTriangle, Inbox, Hourglass, MessageSquare,
} from 'lucide-react'

/* ─── palette ────────────────────────────────────────────────────────────────
   Open / In progress / Closed are the three validated categorical hues — they
   clear the colour-blind separation floor AND 3:1 contrast on white. Reopened
   deliberately is NOT a fourth stacked colour: red vs orange fails the CVD
   floor badly (ΔE 7.1 against a floor of 15), so it never sits beside orange as
   a peer: on a card it only gets its own labelled row when the count is
   non-zero, and in the table it is a plain column. */
const C = {
  open:    '#eb6834',
  prog:    '#2a78d6',
  closed:  '#199e70',
  reopen:  '#d03b3b',
  neutral: '#a8a69a',
}

const TRACK = {
  open:   '#fadfd2',
  prog:   '#d8e6f9',
  closed: '#d5ece2',
  reopen: '#f4dcdc',
  empty:  '#e9e7de',
}

/* Severity bands read off the open ratio, so a community at 100% open never
   wears the same dot as one at 50%. Every colour ships with its text label. */
const SEVERITY = {
  high:    { label: 'High load',  color: C.reopen,  wash: '#fbeded', ink: '#9c2b2b', track: TRACK.reopen },
  watch:   { label: 'Watch',      color: C.open,    wash: '#fdf1ec', ink: '#8f3d1a', track: TRACK.open },
  healthy: { label: 'Healthy',    color: C.closed,  wash: '#e9f5f0', ink: '#0f5f43', track: TRACK.closed },
  clear:   { label: 'No tickets', color: C.neutral, wash: '#f2f1ec', ink: '#56554d', track: TRACK.empty },
}

/* ─── source data ───────────────────────────────────────────────────────────
   Note: `total` does not equal open + prog + reopened + closed in this set
   (48 vs 61) — the two figures come from different places upstream. Status
   proportions are therefore computed against the status total, never `total`. */
const PROJECTS = [
  { name: 'Elegance',             total: 18, open: 9, prog: 5, reopened: 0, closed: 9 },
  { name: 'Emerald Heights',      total:  9, open: 6, prog: 3, reopened: 0, closed: 3 },
  { name: 'Sterling Heights',     total:  8, open: 4, prog: 3, reopened: 0, closed: 4 },
  { name: 'Edifice',              total:  7, open: 3, prog: 2, reopened: 0, closed: 4 },
  { name: 'Golden County',        total:  3, open: 3, prog: 0, reopened: 0, closed: 0 },
  { name: 'Golden County Annexe', total:  2, open: 0, prog: 0, reopened: 0, closed: 2 },
  { name: 'Lotus Homes',          total:  1, open: 1, prog: 0, reopened: 0, closed: 0 },
  { name: 'Esteem',               total:  0, open: 0, prog: 0, reopened: 0, closed: 0 },
  { name: 'Serene Park',          total:  0, open: 0, prog: 0, reopened: 0, closed: 0 },
  { name: 'Lakeview',             total:  0, open: 0, prog: 0, reopened: 0, closed: 0 },
  { name: 'Paradise',             total:  0, open: 0, prog: 0, reopened: 0, closed: 0 },
]

/* Open complaints split by what they are about. Note the tail: "Others" (9),
   "Other" (1) and "Other Issue" (1) are three separate buckets that together
   hold 11 — the same as Electricity. Left as-is; it is a source-data problem,
   not a display one, and the panel footer says so rather than silently
   merging them. */
const BUCKETS = [
  { name: 'Electricity',         value: 11 },
  { name: 'Others',              value:  9 },
  { name: 'Plumbing',            value:  3 },
  { name: 'Leakage/Seepage',     value:  2 },
  { name: 'Tiles',               value:  2 },
  { name: 'Head Office',         value:  1 },
  { name: 'House Keeping',       value:  1 },
  { name: 'Parking',             value:  1 },
  { name: 'Other',               value:  1 },
  { name: 'General Maintenance', value:  1 },
  { name: 'Other Issue',         value:  1 },
]

const BUCKET_TOTAL = BUCKETS.reduce((acc, b) => acc + b.value, 0)

/* Two buckets hold 61% of everything open and the other nine are ties at 1 and
   2, so a flat ranked list spent eight of its eleven rows saying nothing. Any
   bucket holding a tenth of the total leads; the rest go to a compact register
   that stays legible without pretending the ties are distinguishable. */
const BUCKET_LEAD_CUT = 0.1
const BUCKET_LEADS = BUCKETS.filter(b => b.value / BUCKET_TOTAL >= BUCKET_LEAD_CUT)
const BUCKET_TAIL = BUCKETS.filter(b => b.value / BUCKET_TOTAL < BUCKET_LEAD_CUT)
const BUCKET_TAIL_TOTAL = BUCKET_TAIL.reduce((acc, b) => acc + b.value, 0)
const bucketShare = value => Math.round((value / BUCKET_TOTAL) * 100)

/* The triage queue. Colour is the least of the four signals here — each tile
   carries an icon, a title and a description — so the red/orange pair that
   fails the CVD floor as chart marks is fine at this job. */
const ATTENTION = [
  { key: 'sla',        Icon: AlertTriangle, label: 'SLA breached',      desc: 'Past promised resolution time',     value:  7, wash: '#fbeded', ink: '#9c2b2b' },
  { key: 'unassigned', Icon: Inbox,         label: 'Unassigned / New',  desc: 'Not yet routed to a team',          value:  3, wash: '#ecf3fd', ink: '#1b5494' },
  { key: 'ageing',     Icon: Hourglass,     label: 'Ageing over 14 days', desc: 'Open longer than normal',         value:  7, wash: '#fdf1ec', ink: '#8f3d1a' },
  { key: 'awaiting',   Icon: MessageSquare, label: 'Awaiting resident', desc: 'Resolved, waiting on confirmation', value: 14, wash: '#f2f1ec', ink: '#56554d' },
]

const VIEWS = [
  { id: 'split', label: 'Split', Icon: LayoutList, hint: 'Cards for the communities carrying the load, a table for the long tail.' },
  { id: 'cards', label: 'Cards', Icon: LayoutGrid, hint: 'Every community as a card, still grouped by load.' },
  { id: 'table', label: 'Table', Icon: Table2,     hint: 'Everything in rows, still grouped by load. Sort any numeric column.' },
]

/* ─── derivation ────────────────────────────────────────────────────────── */

/** Open ratio mirrors the source report: open / (open + closed). In-progress
 *  tickets are excluded from both sides — that is upstream behaviour, kept so
 *  the figures reconcile with the existing report. */
function severityFor(total, ratio) {
  if (total === 0) return SEVERITY.clear
  if (ratio >= 67) return SEVERITY.high
  if (ratio >= 34) return SEVERITY.watch
  return SEVERITY.healthy
}

function derive(p) {
  const base = p.open + p.closed
  const ratio = base > 0 ? Math.round((p.open / base) * 100) : 0

  return {
    ...p,
    ratio,
    ratioLabel: p.total === 0 ? '—' : `${ratio}%`,
    sev: severityFor(p.total, ratio),
  }
}

const sum = (list, key) => list.reduce((acc, r) => acc + r[key], 0)

/* ─── pieces ─────────────────────────────────────────────────────────────── */




function Dot({ color, size = 11 }) {
  return <span className="shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}

function LegendItem({ color, value, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="shrink-0 rounded-[3px]" style={{ width: 10, height: 10, background: color }} />
      <span className={clsx('font-semibold tabular-nums', value > 0 ? 'text-[#1b1a16]' : 'text-[#8b8a80]')}>{value}</span>
      <span className="text-[#56554d]">{label}</span>
    </span>
  )
}


function StatTile({ tile }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#e6e4db] bg-white p-6">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 rounded-[3px]" style={{ width: 11, height: 11, background: tile.color }} />
        <span className="text-[15px] font-medium text-[#56554d]">{tile.label}</span>
      </div>
      <div className="mt-3 text-[40px] font-semibold leading-none tracking-[-1.2px]">{tile.value}</div>
      <div className="mt-auto pt-5">
        <div className="w-full rounded-full" style={{ height: 7, background: tile.track }}>
          <div className="h-full rounded-full" style={{ width: `${tile.pct}%`, background: tile.color }} />
        </div>
        <div className="mt-2.5 text-[13px] text-[#6f6d63]">{tile.caption}</div>
      </div>
    </div>
  )
}

function SectionHead({ group }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
      <h2 className="text-[18px] font-semibold tracking-[-0.2px]">{group.heading}</h2>
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums"
        style={{ background: group.badgeWash, color: group.badgeInk }}
      >
        {group.badge}
      </span>
      <span className="text-[14.5px] text-[#56554d]">{group.sub}</span>
    </div>
  )
}

/** Shared chrome for the two analysis panels: titled head, body, quiet footer. */
function Panel({ title, subtitle, footer, children }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-[#e6e4db] bg-white">
      <div className="border-b border-[#eeece4] px-6 py-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.2px]">{title}</h2>
        <p className="mt-1 text-[13.5px] text-[#56554d]">{subtitle}</p>
      </div>
      <div className="flex-1 px-6 py-5">{children}</div>
      {footer && (
        <div className="border-t border-[#eeece4] bg-[#faf9f5] px-6 py-3.5 text-[13px] leading-snug text-[#56554d]">
          {footer}
        </div>
      )}
    </section>
  )
}

/** A dominant bucket. The bar reads share of ALL open complaints, not share of
 *  the biggest bucket — so a third-full bar means a third of the problem. */
function BucketLead({ name, value }) {
  const share = bucketShare(value)
  return (
    <div className="rounded-xl border border-[#e6e4db] bg-[#faf9f5] px-5 py-5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[38px] font-semibold leading-none tracking-[-1.3px]">{value}</span>
        <span className="text-[14px] text-[#56554d]">{share}% of open</span>
      </div>
      <div className="mt-3 truncate text-[15.5px] font-semibold" title={name}>{name}</div>
      <div className="mt-3.5 h-2 rounded-full bg-[#e9e7de]">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${share}%`, background: C.open }} />
      </div>
    </div>
  )
}

/** The tail, as a register. Ties at 1 stay ties — no bar pretends otherwise. */
function BucketTailRow({ name, value }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
      <span className="truncate text-[14.5px] text-[#1b1a16]" title={name}>{name}</span>
      <span className={clsx('shrink-0 text-[16px] font-semibold tabular-nums', value > 1 ? 'text-[#1b1a16]' : 'text-[#6f6d63]')}>
        {value}
      </span>
    </div>
  )
}

/** A triage tile. It is a real button: these filter the list below. */
function AttentionTile({ item, onSelect }) {
  const { Icon } = item
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.key)}
      className="group flex w-full items-center gap-4 rounded-xl border border-[#e6e4db] bg-white px-4 py-4 text-left transition-all hover:border-[#c9c5b6] hover:shadow-[0_1px_2px_rgba(27,26,22,0.05),0_8px_20px_-12px_rgba(27,26,22,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: item.wash, color: item.ink }}>
        <Icon size={20} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{item.label}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[#56554d]">{item.desc}</span>
      </span>
      <span className="shrink-0 text-[26px] font-semibold leading-none tabular-nums" style={{ color: item.ink }}>
        {item.value}
      </span>
      <ChevronRight size={18} className="shrink-0 text-[#a8a69a] transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/** One status, as a labelled bar. `scaleMax` is the largest single status count
 *  across every community, so bars are comparable BETWEEN cards, not just
 *  within one — Elegance's 9 open reads visibly longer than Emerald's 6. A
 *  per-card stacked bar normalised each card to itself and lost exactly that. */
function StatusRow({ label, value, color, scaleMax }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="w-[92px] shrink-0 text-[14px] text-[#56554d]">{label}</span>
      <span className="h-2.5 min-w-0 flex-1 rounded-full bg-[#f1efe7]">
        <span
          className="block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${scaleMax > 0 ? (value / scaleMax) * 100 : 0}%`, background: color }}
        />
      </span>
      <span className={clsx('w-7 shrink-0 text-right text-[18px] font-semibold tabular-nums', numInk(value))}>
        {value}
      </span>
    </div>
  )
}

function ProjectCard({ row, scaleMax, onSelect }) {
  const statuses = [
    { key: 'open',   label: 'Open',        value: row.open,     color: C.open },
    { key: 'prog',   label: 'In progress', value: row.prog,     color: C.prog },
    ...(row.reopened > 0
      ? [{ key: 'reopen', label: 'Reopened', value: row.reopened, color: C.reopen }]
      : []),
    { key: 'closed', label: 'Closed',      value: row.closed,   color: C.closed },
  ]

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#e6e4db] bg-white transition-shadow duration-150 hover:shadow-[0_1px_2px_rgba(27,26,22,0.05),0_14px_32px_-14px_rgba(27,26,22,0.22)]">
      {/* The tinted band carries severity for the whole card, so the row below
          needs neither a coloured dot nor a pill. The label is always spelled
          out beside it — the tint never carries the meaning by itself. */}
      <div className="flex items-center gap-3 px-6 py-4" style={{ background: row.sev.wash, color: row.sev.ink }}>
        <h3 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-[-0.2px]">{row.name}</h3>
        <span className="shrink-0 text-[12.5px] font-semibold uppercase tracking-[0.6px]">{row.sev.label}</span>
      </div>

      {row.total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9f5f0]">
            <Check size={24} style={{ color: C.closed }} />
          </span>
          <p className="text-[15px] text-[#56554d]">Nothing logged this period</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[44px] font-semibold leading-none tracking-[-1.6px]">{row.total}</div>
              <div className="mt-2.5 text-[14px] text-[#56554d]">complaints logged</div>
            </div>
            <div className="text-right">
              {/* The severity's dark step, not its mark colour — the mark hues
                  are too light to sit under 4.5:1 as text. */}
              <div className="text-[30px] font-semibold leading-none tracking-[-0.8px]" style={{ color: row.sev.ink }}>
                {row.ratioLabel}
              </div>
              <div className="mt-2.5 text-[14px] text-[#56554d]">still open</div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4">
            {statuses.map(({ key, ...s }) => <StatusRow key={key} {...s} scaleMax={scaleMax} />)}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect?.(row)}
        className="group/cta mt-auto flex items-center justify-center gap-2 border-t border-[#eeece4] bg-[#faf9f5] px-6 py-4 text-[15px] font-medium text-[#1b1a16] transition-colors hover:bg-[#f1f0ea] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2a78d6]"
      >
        {row.total === 0 ? 'Open community' : `View all ${row.total}`}
        <ArrowRight size={17} className="transition-transform group-hover/cta:translate-x-0.5" />
      </button>
    </article>
  )
}

/* Everything left-aligns, values under their own header. Right-aligned numerals
   are the usual convention, but with one- and two-digit counts the gain is nil
   and the header/value mismatch is what you actually notice. `tabular-nums`
   still does the vertical work. */
const COLUMNS = [
  { key: 'name',     label: 'Community',   sortable: false },
  { key: 'total',    label: 'Logged',      sortable: true },
  { key: 'open',     label: 'Open',        sortable: true },
  { key: 'prog',     label: 'In progress', sortable: true },
  { key: 'reopened', label: 'Reopened',    sortable: true },
  { key: 'closed',   label: 'Closed',      sortable: true },
  { key: 'action',   label: 'Action',      sortable: false },
]

/* Fixed columns total 760px. The row's min-width has to clear that by enough for
   the community name to still hold the longest one ("Golden County Annexe",
   ~265px at 17px) or it truncates. 1110px is that floor; past it the row
   scrolls. The status bar and ratio meter live on the cards, not here — this
   table is the numbers. */
const GRID = 'grid grid-cols-[minmax(0,1fr)_120px_110px_142px_128px_110px_150px] items-center'
const GRID_MIN_W = 'min-w-[1110px]'

function numInk(n) {
  return n > 0 ? 'text-[#1b1a16]' : 'text-[#8b8a80]'
}

function SummaryTable({ group, sort, onSort, onSelect }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6e4db] bg-white">
      {/* Wide layout: the real table */}
      <div className="hidden overflow-x-auto lg:block">
        <div className={GRID_MIN_W}>
          <div className={clsx(GRID, 'h-[62px] border-b border-[#eeece4] bg-[#faf9f5] px-6')}>
            {COLUMNS.map(col => {
              const active = sort.key === col.key
              return (
                <div key={col.key} className="flex justify-start">
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 py-1 text-[14px] font-semibold uppercase tracking-[0.4px] transition-colors hover:text-[#1b1a16]',
                        active ? 'text-[#1b1a16]' : 'text-[#6f6d63]',
                      )}
                    >
                      {col.label}
                      <ChevronDown
                        size={15}
                        className={clsx('transition-transform', active ? 'opacity-100' : 'opacity-30', active && sort.dir === 'asc' && 'rotate-180')}
                      />
                    </button>
                  ) : (
                    <span className="text-[14px] font-semibold uppercase tracking-[0.4px] text-[#6f6d63]">{col.label}</span>
                  )}
                </div>
              )
            })}
          </div>

          {group.items.map(row => (
            <div key={row.name} className={clsx(GRID, 'group h-[84px] border-b border-[#f1efe7] px-6 transition-colors hover:bg-[#faf9f5]')}>
              <div className="flex min-w-0 items-center gap-3.5 pr-4">
                {/* The tag is gone from this view, so the dot carries its meaning in a
                    tooltip and for screen readers rather than by colour alone. */}
                <span className="flex shrink-0 items-center" title={`${row.sev.label}${row.total === 0 ? '' : ` — ${row.ratioLabel} open`}`}>
                  <Dot color={row.sev.color} size={12} />
                  <span className="sr-only">{row.sev.label}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.2px]">{row.name}</span>
              </div>
              <div className="text-[19px] font-bold tabular-nums">{row.total}</div>
              <div className={clsx('text-[19px] font-medium tabular-nums', numInk(row.open))}>{row.open}</div>
              <div className={clsx('text-[19px] font-medium tabular-nums', numInk(row.prog))}>{row.prog}</div>
              <div className={clsx('text-[19px] font-medium tabular-nums', numInk(row.reopened))}>{row.reopened}</div>
              <div className={clsx('text-[19px] font-medium tabular-nums', numInk(row.closed))}>{row.closed}</div>
              <div className="flex items-center justify-start gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelect?.(row)}
                  className="-ml-3.5 inline-flex h-12 items-center gap-2 rounded-xl border border-transparent px-3.5 text-[16px] font-medium text-[#1b1a16] transition-colors group-hover:border-[#d3d0c4] group-hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a78d6]"
                >
                  Detail
                  <ArrowRight size={17} />
                </button>
                <button
                  type="button"
                  aria-label={`More actions for ${row.name}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#6f6d63] transition-colors hover:bg-[#f1f0ea]"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Narrow layout: the same rows, stacked into a tappable list */}
      <div className="lg:hidden">
        {group.items.map(row => (
          <button
            key={row.name}
            type="button"
            onClick={() => onSelect?.(row)}
            className="flex w-full items-center gap-3.5 border-b border-[#f1efe7] px-5 py-[18px] text-left transition-colors hover:bg-[#faf9f5]"
          >
            <span className="flex shrink-0 items-center" title={row.sev.label}>
              <Dot color={row.sev.color} size={12} />
              <span className="sr-only">{row.sev.label}</span>
            </span>
            <span className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-[-0.2px]">{row.name}</span>
            <span className={clsx('w-10 shrink-0 text-right text-[18px] font-bold tabular-nums', numInk(row.total))}>{row.total}</span>
            <span className={clsx('w-10 shrink-0 text-right text-[16px] tabular-nums', row.open > 0 ? 'text-[#56554d]' : 'text-[#8b8a80]')}>
              {row.open}
            </span>
            <ChevronRight size={18} className="shrink-0 text-[#a8a69a]" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5 bg-[#faf9f5] px-6 py-[18px] text-[15px] text-[#56554d]">
        {group.clearCount > 0 && <Check size={17} style={{ color: C.closed }} />}
        {group.footer}
      </div>
    </div>
  )
}

/* ─── the dashboard ──────────────────────────────────────────────────────── */

export default function ComplaintsSummary({
  projects = PROJECTS,
  spotlightCount = 4,
  initialView = 'split',
  onSelectProject,
  onFilterSelect,
}) {
  const [view, setView] = useState(initialView)
  const [sort, setSort] = useState({ key: 'total', dir: 'desc' })
  const [query, setQuery] = useState('')

  const model = useMemo(() => {
    const rows = projects.map(derive)
    const spotN = Math.max(2, Math.min(6, spotlightCount))

    // Ranked on the full set, so searching never re-shuffles who is "top N".
    const ranked = [...rows].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    const top = ranked.slice(0, spotN)
    const rest = ranked.slice(spotN)

    const totals = {
      total:    sum(rows, 'total'),
      open:     sum(rows, 'open'),
      prog:     sum(rows, 'prog'),
      reopened: sum(rows, 'reopened'),
      closed:   sum(rows, 'closed'),
    }
    const statusTotal = totals.open + totals.prog + totals.reopened + totals.closed
    // The longest bar any card can draw, so every card shares one scale.
    const scaleMax = Math.max(1, ...rows.map(r => Math.max(r.open, r.prog, r.reopened, r.closed)))
    const share = n => (statusTotal > 0 ? Math.round((n / statusTotal) * 100) : 0)

    const topTotal = sum(top, 'total')
    const restTotal = totals.total - topTotal
    const topShare = totals.total > 0 ? Math.round((topTotal / totals.total) * 100) : 0
    const clearCount = rest.filter(r => r.total === 0).length

    return {
      rows, top, rest, spotN, totals, statusTotal, share, scaleMax,
      topTotal, restTotal, topShare, clearCount,
      topPct: totals.total > 0 ? (topTotal / totals.total) * 100 : 0,
      restPct: totals.total > 0 ? (restTotal / totals.total) * 100 : 100,
      tiles: [
        { key: 'open',   label: 'Open',        value: totals.open,     color: C.open,   track: TRACK.open,   pct: share(totals.open),   caption: `${share(totals.open)}% of the live status mix` },
        { key: 'prog',   label: 'In progress', value: totals.prog,     color: C.prog,   track: TRACK.prog,   pct: share(totals.prog),   caption: `${share(totals.prog)}% of the live status mix` },
        { key: 'reopen', label: 'Reopened',    value: totals.reopened, color: C.reopen, track: TRACK.reopen, pct: share(totals.reopened), caption: totals.reopened === 0 ? 'No regressions this period' : `${share(totals.reopened)}% of the live status mix` },
        { key: 'closed', label: 'Closed',      value: totals.closed,   color: C.closed, track: TRACK.closed, pct: share(totals.closed), caption: `${share(totals.closed)}% of the live status mix` },
      ],
    }
  }, [projects, spotlightCount])

  const { cardGroups, tableGroups } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = list => (q ? list.filter(r => r.name.toLowerCase().includes(q)) : list)

    const sortRows = list => {
      const dir = sort.dir === 'asc' ? 1 : -1
      return [...list].sort((a, b) => (a[sort.key] - b[sort.key]) * dir || a.name.localeCompare(b.name))
    }

    const priority = {
      id: 'priority',
      heading: 'Carrying the load',
      badge: `Top ${model.spotN}`,
      badgeWash: '#1b1a16',
      badgeInk: '#ffffff',
      sub: `${model.topTotal} of ${model.totals.total} complaints — ${model.topShare}% of the total`,
      items: match(model.top),
      footer: 'Ranked by complaints logged in the selected period.',
      clearCount: 0,
    }
    const rest = {
      id: 'rest',
      heading: 'Everywhere else',
      badge: String(model.rest.length),
      badgeWash: '#ece9df',
      badgeInk: '#56554d',
      sub: `${model.rest.length} communities · ${model.restTotal} complaints${model.clearCount > 0 ? ` · ${model.clearCount} with nothing logged` : ''}`,
      items: match(model.rest),
      footer: model.clearCount > 0
        ? `${model.clearCount} of these have nothing logged this period.`
        : `Showing all ${model.rest.length} remaining communities.`,
      clearCount: model.clearCount,
    }

    const withSorted = g => ({ ...g, items: sortRows(g.items) })
    const live = g => g.items.length > 0

    if (view === 'cards') return { cardGroups: [priority, rest].filter(live), tableGroups: [] }
    if (view === 'table') return { cardGroups: [], tableGroups: [withSorted(priority), withSorted(rest)].filter(live) }
    return { cardGroups: [priority].filter(live), tableGroups: [withSorted(rest)].filter(live) }
  }, [model, view, sort, query])

  const toggleSort = key =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))

  const hint = VIEWS.find(v => v.id === view)?.hint
  const nothingFound = cardGroups.length === 0 && tableGroups.length === 0

  return (
    <div className="min-h-screen bg-[#f1f0ea] px-5 py-6 text-[#1b1a16] sm:px-7 sm:py-8 lg:px-10 lg:py-10 [&>*]:mx-auto [&>*]:max-w-[1680px]">

      {/* header */}
      <header className="flex flex-wrap items-start gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1b1a16] text-white">
          <Building2 size={26} strokeWidth={1.6} />
        </div>
        <div className="min-w-[260px] flex-1">
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.7px]">Project-wise complaints summary</h1>
          <p className="mt-1.5 text-[15px] text-[#56554d]">
            Live status across {model.rows.length} communities · Open, In progress, Reopened &amp; Closed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex items-center">
            <label htmlFor="complaint-search" className="sr-only">Search community</label>
            <Search size={17} className="pointer-events-none absolute left-4 text-[#6f6d63]" />
            <input
              id="complaint-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search community"
              className="h-12 w-[260px] rounded-xl border border-[#d3d0c4] bg-white pl-11 pr-4 text-[15px] text-[#1b1a16] placeholder-[#8b8a80] transition-colors focus:border-[#2a78d6] focus:outline-none focus:ring-2 focus:ring-[#2a78d6]/15"
            />
          </div>
          <label htmlFor="complaint-range" className="sr-only">Date range</label>
          <select
            id="complaint-range"
            defaultValue="30"
            className="h-12 cursor-pointer rounded-xl border border-[#d3d0c4] bg-white px-4 text-[15px] font-medium text-[#1b1a16] transition-colors hover:bg-[#f4f3ee] focus:border-[#2a78d6] focus:outline-none"
          >
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
            <option value="90">Last 90 days</option>
            <option value="mtd">Month to date</option>
          </select>
          <button
            type="button"
            className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-[#d3d0c4] bg-white px-5 text-[15px] font-medium text-[#1b1a16] transition-colors hover:border-[#b9b5a6] hover:bg-[#f4f3ee]"
          >
            <Download size={17} />
            Export
          </button>
        </div>
      </header>

      {/* hero + stat tiles */}
      <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col rounded-2xl border border-[#e6e4db] bg-white p-7">
          <div className="text-[14px] font-medium uppercase tracking-[0.3px] text-[#6f6d63]">Total logged</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-[60px] font-semibold leading-none tracking-[-2.2px]">{model.totals.total}</span>
            <span className="text-[15px] text-[#56554d]">complaints · last 30 days</span>
          </div>
          <div className="mt-6 flex" style={{ height: 10, gap: 2 }}>
            <div style={{ width: `${model.topPct}%`, background: '#1b1a16', borderRadius: '999px 3px 3px 999px' }} />
            <div style={{ width: `${model.restPct}%`, background: '#d3d0c4', borderRadius: '3px 999px 999px 3px' }} />
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
            <LegendItem color="#1b1a16" value={model.topTotal} label={`from top ${model.spotN}`} />
            <LegendItem color="#d3d0c4" value={model.restTotal} label="everywhere else" />
          </div>
          <p className="mt-auto pt-5 text-[14.5px] leading-relaxed text-[#56554d]">
            {model.topShare}% of everything logged sits in {model.spotN} communities — the reason they get their own row of cards.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {model.tiles.map(tile => <StatTile key={tile.key} tile={tile} />)}
        </div>
      </div>

      {/* Ranked buckets beside the triage queue. The 1.6/1 split is what makes
          the two panels land at nearly the same height — eleven bar rows on the
          left, four stacked tiles on the right — instead of leaving half a
          column of dead space under the tiles. */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Open complaints — by bucket"
          subtitle="Head office vs on-site trades"
          footer={<>{BUCKET_TOTAL} open across {BUCKETS.length} buckets &middot; &ldquo;Others&rdquo;, &ldquo;Other&rdquo; and &ldquo;Other Issue&rdquo; hold 11 between them, the same as Electricity</>}
        >
          <div className="flex flex-col">
            <div className="grid gap-4 sm:grid-cols-2">
              {BUCKET_LEADS.map(b => <BucketLead key={b.name} name={b.name} value={b.value} />)}
            </div>

            <div className="mt-6 flex items-baseline justify-between gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.5px] text-[#6f6d63]">
                {BUCKET_TAIL.length} smaller buckets
              </h3>
              <span className="text-[13.5px] text-[#56554d]">
                <span className="font-semibold text-[#1b1a16] tabular-nums">{BUCKET_TAIL_TOTAL}</span> between them
              </span>
            </div>

            {/* gap-px over a hairline-coloured ground draws the dividers in both
                axes; the filler keeps the ground from showing as an empty cell
                when the count is odd. */}
            <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#e6e4db] bg-[#e6e4db] sm:grid-cols-2">
              {BUCKET_TAIL.map(b => <BucketTailRow key={b.name} name={b.name} value={b.value} />)}
              {BUCKET_TAIL.length % 2 === 1 && <div className="hidden bg-white sm:block" />}
            </div>
          </div>
        </Panel>

        <Panel
          title="Needs attention today"
          subtitle="Act on these today — select one to filter the list"
        >
          {/* Two across once the panels stack, one across when this panel is the
              narrow column beside the buckets — otherwise the tiles stretch to
              a metre wide with the count marooned at the far end. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {ATTENTION.map(item => <AttentionTile key={item.key} item={item} onSelect={onFilterSelect} />)}
          </div>
        </Panel>
      </div>

      {/* view switcher */}
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 rounded-2xl bg-[#e7e5dc] p-1.5">
          {VIEWS.map(({ id, label, Icon }) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={active}
                className={clsx(
                  'inline-flex h-11 items-center gap-2.5 rounded-xl px-5 text-[15px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2a78d6]',
                  active ? 'bg-white font-semibold text-[#1b1a16] shadow-sm' : 'font-medium text-[#56554d] hover:text-[#1b1a16]',
                )}
              >
                <Icon size={17} className={active ? 'opacity-85' : 'opacity-50'} />
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[14.5px] text-[#56554d]">{hint}</p>
        <div className="ml-auto inline-flex h-10 items-center gap-2.5 rounded-full border border-[#d3d0c4] bg-white px-4 text-[14px] text-[#56554d]">
          <Dot color={C.closed} size={8} />
          Synced 2 minutes ago
        </div>
      </div>

      {/* body */}
      <div className="mt-6 flex flex-col gap-9">
        {cardGroups.map(group => (
          <section key={group.id} className="flex flex-col gap-4">
            <SectionHead group={group} />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {group.items.map(row => (
                <ProjectCard key={row.name} row={row} scaleMax={model.scaleMax} onSelect={onSelectProject} />
              ))}
            </div>
          </section>
        ))}

        {tableGroups.map(group => (
          <section key={group.id} className="flex flex-col gap-4">
            <SectionHead group={group} />
            <SummaryTable group={group} sort={sort} onSort={toggleSort} onSelect={onSelectProject} />
          </section>
        ))}

        {nothingFound && (
          <div className="rounded-2xl border border-dashed border-[#d3d0c4] bg-white/60 px-6 py-16 text-center">
            <p className="text-[17px] font-semibold">No community matches “{query}”</p>
            <p className="mt-2 text-[15px] text-[#56554d]">Check the spelling, or clear the search to see all {model.rows.length}.</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-5 inline-flex h-11 items-center rounded-xl border border-[#d3d0c4] bg-white px-5 text-[15px] font-medium transition-colors hover:bg-[#f4f3ee]"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
