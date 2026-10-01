import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import type { DateSpan } from '@/lib/api'
import { font, useLayout } from '@/lib/theme'
import { Button, haptic, Sheet, Txt } from '@/components/ui'

/**
 * Pick a span of whole days: tap the first day, then the last. Days after
 * today can't be picked, and once a start is chosen nothing more than
 * `maxDays` away can be either — so every span you can tap is one the server
 * accepts. Dates are YYYY-MM-DD in this device's time zone.
 */
const C = {
  primary: '#0066FF', band: '#EBF2FF', ink: '#0F172A', text: '#1E293B', muted: '#64748B', faint: '#94A3B8', disabled: '#CBD5E1',
  line: '#E2E8F0', soft: '#F1F5F9',
}
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
type PressState = { pressed: boolean; hovered?: boolean }

// ── Calendar arithmetic on local dates ───────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y!, m! - 1, d!) }
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return isoDay(d) }
/** Days from `a` through `b`, both included. Rounded, so a DST shift doesn't lose a day. */
export const spanDays = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000) + 1

/** "3 Sep – 18 Sep" · "28 Dec 2025 – 4 Jan 2026" · "Wed, 3 Sep" */
export function formatSpan({ from, to }: DateSpan): string {
  const thisYear = new Date().getFullYear()
  const a = parseDay(from)
  const b = parseDay(to)
  if (from === to) return a.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(a.getFullYear() !== thisYear && { year: 'numeric' }) })
  const withYear = a.getFullYear() !== b.getFullYear() || b.getFullYear() !== thisYear
  const f = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }) })
  return `${f(a)} – ${f(b)}`
}

function presets(today: string, maxDays: number): { key: string; label: string; span: DateSpan }[] {
  const t = parseDay(today)
  const monthStart = isoDay(new Date(t.getFullYear(), t.getMonth(), 1))
  const lastMonthStart = isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1))
  const lastMonthEnd = isoDay(new Date(t.getFullYear(), t.getMonth(), 0))
  return [
    { key: 'yesterday', label: 'Yesterday', span: { from: addDays(today, -1), to: addDays(today, -1) } },
    { key: '14d', label: 'Last 14 days', span: { from: addDays(today, -13), to: today } },
    { key: 'month', label: 'This month', span: { from: monthStart, to: today } },
    { key: 'lastMonth', label: 'Last month', span: { from: lastMonthStart, to: lastMonthEnd } },
    { key: 'max', label: `Last ${maxDays} days`, span: { from: addDays(today, -(maxDays - 1)), to: today } },
  ]
}

export function DateRangeSheet({ visible, value, onClose, onApply, maxDays = 90 }: {
  visible: boolean
  value: DateSpan | null
  onClose: () => void
  onApply: (span: DateSpan) => void
  maxDays?: number
}) {
  const today = isoDay(new Date())
  // Tablets and desktops see two months side by side; `month` is the right-hand one.
  const { isWide } = useLayout()
  const [start, setStart] = useState<string | null>(value?.from ?? null)
  const [end, setEnd] = useState<string | null>(value?.to ?? null)
  const [month, setMonth] = useState(() => focusMonth(value, today, isWide))

  // Each opening starts from what's applied, not from an abandoned edit.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setStart(value?.from ?? null)
      setEnd(value?.to ?? null)
      setMonth(focusMonth(value, today, isWide))
    }
  }

  const quick = useMemo(() => presets(today, maxDays), [today, maxDays])
  const months = isWide ? [shiftMonth(month, -1), month] : [month]
  const latestMonth = today.slice(0, 7)
  const earliestMonth = addDays(today, -365 * 2).slice(0, 7)
  const canBack = months[0]! > earliestMonth
  const canForward = month < latestMonth
  const step = (by: number) => { haptic(); setMonth(shiftMonth(month, by)) }

  // While choosing the end, days further than maxDays from the start are out of reach.
  const picking = start !== null && end === null
  const lastAllowed = picking ? [today, addDays(start, maxDays - 1)].sort()[0]! : today

  const tap = (d: string) => {
    haptic()
    if (!start || end) { setStart(d); setEnd(null); return }
    if (d < start) { setStart(d); return }
    setEnd(d)
  }
  const pickPreset = (span: DateSpan) => { haptic(); setStart(span.from); setEnd(span.to); setMonth(focusMonth(span, today, isWide)) }

  const chosen: DateSpan | null = start ? { from: start, to: end ?? start } : null
  const days = chosen ? spanDays(chosen.from, chosen.to) : 0
  const activePreset = chosen && end ? quick.find(p => p.span.from === chosen.from && p.span.to === chosen.to)?.key : undefined

  const navButton = (by: -1 | 1) => {
    const enabled = by < 0 ? canBack : canForward
    return (
      <Pressable onPress={() => step(by)} disabled={!enabled} accessibilityRole="button" accessibilityLabel={by < 0 ? 'Previous month' : 'Next month'} hitSlop={6}
        style={(s) => [styles.monthBtn, !enabled && { opacity: 0.35 }, ((s as PressState).hovered || (s as PressState).pressed) && { backgroundColor: C.soft }]}>
        {by < 0 ? <ChevronLeft size={16} color={C.text} strokeWidth={2.2} /> : <ChevronRight size={16} color={C.text} strokeWidth={2.2} />}
      </Pressable>
    )
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Custom range" subtitle={`Pick a start and end day — up to ${maxDays} days`} width={isWide ? 680 : 400}
      footer={
        <View style={styles.footer}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt style={styles.summary} numberOfLines={1}>{chosen ? formatSpan(chosen) : 'No days selected'}</Txt>
            <Txt style={styles.summarySub}>{chosen ? (picking ? `${days} day · tap an end day, or apply` : `${days} ${days === 1 ? 'day' : 'days'}`) : 'Tap a start day'}</Txt>
          </View>
          <Button title="Apply" size="sm" disabled={!chosen} onPress={() => { if (chosen) onApply(chosen) }} style={{ paddingHorizontal: 18 }} />
        </View>
      }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {quick.map(p => {
          const on = activePreset === p.key
          return (
            <Pressable key={p.key} onPress={() => pickPreset(p.span)} accessibilityRole="button" aria-selected={on}
              style={(s) => [styles.preset, on && styles.presetOn, !on && ((s as PressState).hovered || (s as PressState).pressed) && { backgroundColor: C.soft }]}>
              <Txt style={[styles.presetText, on && { color: C.primary }]}>{p.label}</Txt>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={[styles.calendar, isWide && styles.calendarWide]}>
        {months.map((mo, i) => (
          <View key={mo} style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.monthRow}>
              {i === 0 ? navButton(-1) : <View style={styles.monthBtnSpacer} />}
              <Txt style={styles.monthTitle} accessibilityRole="header">{monthTitle(mo)}</Txt>
              {i === months.length - 1 ? navButton(1) : <View style={styles.monthBtnSpacer} />}
            </View>
            <MonthGrid month={mo} today={today} from={chosen?.from} to={end ?? undefined} lastAllowed={lastAllowed} onTap={tap} />
          </View>
        ))}
      </View>
    </Sheet>
  )
}

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return isoDay(new Date(y, m - 1 + by, 1)).slice(0, 7)
}
const monthTitle = (month: string) => parseDay(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

/**
 * Which month to show for a span. One month at a time: the one holding its
 * middle, so most of the highlighted days are on screen. Two at a time: end
 * on the span's last month, so a span crossing a month boundary shows whole.
 */
function focusMonth(span: DateSpan | null | undefined, today: string, pair: boolean): string {
  if (!span) return today.slice(0, 7)
  if (pair) return span.to.slice(0, 7)
  return addDays(span.from, Math.floor((spanDays(span.from, span.to) - 1) / 2)).slice(0, 7)
}

function MonthGrid({ month, today, from, to, lastAllowed, onTap }: {
  month: string; today: string; from?: string; to?: string; lastAllowed: string; onTap: (day: string) => void
}) {
  const first = parseDay(`${month}-01`)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`),
  ]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => <Txt key={i} style={styles.weekday}>{w}</Txt>)}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((d, di) => {
            if (!d) return <View key={di} style={styles.cell} />
            const disabled = d > lastAllowed
            const isStart = d === from
            const isEnd = d === to
            const inside = !!from && !!to && d > from && d < to
            const isToday = d === today
            const label = parseDay(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
            return (
              <Pressable key={di} disabled={disabled} onPress={() => onTap(d)} style={styles.cell}
                accessibilityRole="button" accessibilityLabel={`${label}${isToday ? ', today' : ''}`} aria-selected={isStart || isEnd || inside} aria-disabled={disabled}>
                {/* The band joins start to end; half-cells at the ends so it meets the circles. */}
                {(inside || (isStart && to && to !== from) || (isEnd && from !== to)) && (
                  <View style={[styles.band, isStart && { left: '50%' }, isEnd && { right: '50%' }]} />
                )}
                <DayDot day={Number(d.slice(8))} selected={isStart || isEnd} inside={inside} disabled={disabled} today={isToday} />
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function DayDot({ day, selected, inside, disabled, today }: { day: number; selected: boolean; inside: boolean; disabled: boolean; today: boolean }) {
  return (
    <View style={[styles.dot, selected && styles.dotOn, !selected && today && styles.dotToday]}>
      <Txt style={[
        styles.dayText,
        inside && { color: C.primary, fontFamily: font.semibold },
        selected && { color: '#FFFFFF', fontFamily: font.bold },
        disabled && { color: C.disabled },
      ]}>{day}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  presets: { gap: 6, paddingHorizontal: 20, paddingBottom: 12 },
  preset: { height: 30, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  presetOn: { borderColor: C.primary, backgroundColor: C.band },
  presetText: { fontFamily: font.semibold, fontSize: 11.5, color: C.text },
  calendar: { paddingHorizontal: 14, paddingBottom: 4 },
  calendarWide: { flexDirection: 'row', gap: 24, paddingHorizontal: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 },
  monthBtn: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  monthBtnSpacer: { width: 32, height: 32 },
  monthTitle: { fontFamily: font.bold, fontSize: 13.5, color: C.ink },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontFamily: font.semibold, fontSize: 10.5, color: C.faint, paddingVertical: 6 },
  cell: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: 4, bottom: 4, backgroundColor: C.band },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: C.primary },
  dotToday: { borderWidth: 1.5, borderColor: C.primary },
  dayText: { fontFamily: font.medium, fontSize: 12.5, color: C.text, fontVariant: ['tabular-nums'] },
  footer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { fontFamily: font.bold, fontSize: 13, color: C.ink },
  summarySub: { fontFamily: font.regular, fontSize: 11, color: C.muted, marginTop: 1 },
})
