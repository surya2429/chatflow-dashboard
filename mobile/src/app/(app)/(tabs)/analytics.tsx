import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  CalendarRange, ChevronDown, CircleCheckBig, MessagesSquare, Pencil, Timer, TrendingDown, TrendingUp, Trophy, WifiOff, type LucideIcon,
} from 'lucide-react-native'
import { api, errorMessage, type AgentAnalytics, type AnalyticsRange, type DateSpan } from '@/lib/api'
import { useUser } from '@/lib/auth'
import { can } from '@/lib/session'
import { useStore } from '@/lib/store'
import { font, useLayout } from '@/lib/theme'
import { Avatar, haptic, Notice, Segmented, Sheet, SheetRow, Skeleton, Txt } from '@/components/ui'
import { ColumnChart, Donut, LineChart, Meter, Sparkline } from '@/components/charts'
import { DateRangeSheet, formatSpan, spanDays } from '@/components/DateRangeSheet'

/**
 * Agent analytics: how much, how fast, how well — for the chosen period, each
 * compared with the period before. Supervisors can switch to any teammate.
 */
const C = {
  primary: '#0066FF', ink: '#0F172A', text: '#1E293B', muted: '#64748B', faint: '#94A3B8', line: '#E2E8F0', soft: '#F1F5F9', page: '#F8FAFC',
  good: '#047857', goodBg: '#ECFDF5', bad: '#B91C1C', badBg: '#FEF2F2',
}
const CHANNEL = [
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { key: 'instagram', label: 'Instagram', color: '#E1306C' },
  { key: 'webchat', label: 'Website', color: '#6366F1' },
] as const

/** 45s · 4.2m · 18m · 1h 5m */
function duration(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${Math.round(sec)}s`
  const m = sec / 60
  if (m < 60) return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}m`
  const h = Math.floor(m / 60)
  return `${h}h ${Math.round(m % 60)}m`
}
const compact = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString())

function change(cur: number | null, prev: number | null, lowerIsBetter = false) {
  if (cur === null || prev === null || prev === 0) return null
  const pct = (cur - prev) / prev
  if (Math.abs(pct) < 0.005) return { pct: 0, good: true }
  return { pct, good: lowerIsBetter ? pct < 0 : pct > 0 }
}

/** Weekday names while a week fits, dates beyond that. */
function dayLabel(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  return days <= 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
const dayTitle = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
type PressState = { pressed: boolean; hovered?: boolean }
const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)

export default function Analytics() {
  const me = useUser()
  const team = useStore(s => s.team)
  const { isWide, contentWidth } = useLayout()
  const [range, setRange] = useState<AnalyticsRange>('7d')
  const [agentId, setAgentId] = useState<string | undefined>(undefined)
  const [data, setData] = useState<AgentAnalytics | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [span, setSpan] = useState<DateSpan | null>(null)
  const [spanOpen, setSpanOpen] = useState(false)
  const canPickAgent = can('analytics.team')
  const key = `${range}|${range === 'custom' ? `${span?.from}~${span?.to}` : ''}|${agentId ?? ''}|${nonce}`
  const loading = loadedKey !== key

  useEffect(() => {
    let live = true
    api.agentAnalytics(range, agentId, span ?? undefined)
      .then(d => { if (live) { setData(d); setError(null) } })
      .catch(err => { if (live) setError(errorMessage(err)) })
      .finally(() => { if (live) { setLoadedKey(key); setRefreshing(false) } })
    return () => { live = false }
  }, [range, agentId, span, key])
  const refresh = useCallback(() => { setRefreshing(true); setNonce(n => n + 1) }, [])

  const wide = isWide && contentWidth >= 900
  const k = data?.kpis
  const p = data?.previous
  const viewingSelf = !data || data.agent.id === me.id
  // The period on screen, in days — what labels and charts adapt to.
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : (span ? spanDays(span.from, span.to) : 7)
  const periodName = range === 'today' ? 'yesterday' : days === 1 ? 'the day before' : `the previous ${days} days`
  // One day has no trend to draw: hide the per-day charts and sparklines.
  const oneDay = days === 1
  const chooseRange = (r: AnalyticsRange) => {
    if (r === 'custom') { setSpanOpen(true); return }
    setRange(r)
  }

  const daily = useMemo(() => data?.daily ?? [], [data])
  const tiles: { key: string; label: string; icon: LucideIcon; value: string; sub?: string; delta: ReturnType<typeof change>; spark: (number | null)[]; yesterday: string }[] = k && p ? [
    { key: 'chats', label: 'Chats handled', icon: MessagesSquare, value: compact(k.conversations), sub: `${compact(k.messages)} messages sent`,
      delta: change(k.conversations, p.conversations), spark: daily.map(d => d.conversations), yesterday: compact(p.conversations) },
    { key: 'resolved', label: 'Resolved', icon: CircleCheckBig, value: compact(k.resolved),
      sub: k.resolutionRate === null ? undefined : `${Math.round(k.resolutionRate * 100)}% resolution rate`,
      delta: change(k.resolved, p.resolved), spark: daily.map(d => d.resolved), yesterday: compact(p.resolved) },
    { key: 'reply', label: 'Reply time', icon: Timer, value: duration(k.replySec), sub: 'median, customer → you',
      delta: change(k.replySec, p.replySec, true), spark: daily.map(d => d.replySec), yesterday: duration(p.replySec) },
    { key: 'handle', label: 'Handling time', icon: Timer, value: duration(k.avgHandleSec), sub: 'first reply → resolved',
      delta: change(k.avgHandleSec, p.avgHandleSec, true), spark: [], yesterday: duration(p.avgHandleSec) },
  ] : []

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.title}>Analytics</Txt>
        <Txt style={styles.subtitle} numberOfLines={1}>
          {viewingSelf ? 'Your performance' : `${data?.agent.name}’s performance`}
          {data ? ` · ${data.range.tz.replace(/_/g, ' ')}` : ''}
        </Txt>
      </View>
      {canPickAgent && (
        <Pressable onPress={() => { haptic(); setPickerOpen(true) }} accessibilityRole="button" accessibilityLabel="Choose whose analytics to view"
          style={({ pressed }) => [styles.agentPick, pressed && { backgroundColor: C.soft }]}>
          {data && <Avatar label={data.agent.initials} seed={data.agent.id} size={22} />}
          <Txt style={styles.agentPickText} numberOfLines={1}>{viewingSelf ? 'Me' : data?.agent.name.split(' ')[0]}</Txt>
          <ChevronDown size={14} color={C.muted} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  )

  const kpiGrid = (
    <View style={styles.kpis}>
      {(loading && !data ? [0, 1, 2, 3] : tiles).map((tile, i) => (
        <View key={typeof tile === 'number' ? i : tile.key} style={{ width: wide ? '25%' : '50%', padding: 5 }}>
          {typeof tile === 'number' ? (
            <View style={styles.kpi}><Skeleton w={70} h={10} /><Skeleton w={50} h={22} style={{ marginTop: 10 }} /><Skeleton w={90} h={9} style={{ marginTop: 8 }} /></View>
          ) : (
            <View style={[styles.kpi, loading && { opacity: 0.55 }]} accessibilityLabel={`${tile.label}: ${tile.value}`}>
              <View style={styles.kpiTop}>
                <tile.icon size={13} color={C.faint} strokeWidth={2.2} />
                <Txt style={styles.kpiLabel} numberOfLines={1}>{tile.label}</Txt>
              </View>
              <View style={styles.kpiMid}>
                <Txt style={styles.kpiValue}>{tile.value}</Txt>
                {!oneDay && <Sparkline values={tile.spark} color={C.primary} />}
              </View>
              <View style={styles.kpiBottom}>
                {range === 'today' ? (
                  <Txt style={styles.kpiSub}>Yesterday: {tile.yesterday}</Txt>
                ) : tile.delta ? (
                  <View style={[styles.delta, { backgroundColor: tile.delta.pct === 0 ? C.soft : tile.delta.good ? C.goodBg : C.badBg }]}>
                    {tile.delta.pct !== 0 && (tile.delta.pct > 0
                      ? <TrendingUp size={10} color={tile.delta.good ? C.good : C.bad} strokeWidth={2.6} />
                      : <TrendingDown size={10} color={tile.delta.good ? C.good : C.bad} strokeWidth={2.6} />)}
                    <Txt style={[styles.deltaText, { color: tile.delta.pct === 0 ? C.muted : tile.delta.good ? C.good : C.bad }]}>
                      {tile.delta.pct === 0 ? 'No change' : `${Math.round(Math.abs(tile.delta.pct) * 100)}%`}
                    </Txt>
                  </View>
                ) : <Txt style={styles.kpiSub}>No earlier data</Txt>}
                {tile.sub && <Txt style={styles.kpiSub} numberOfLines={1}>{tile.sub}</Txt>}
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  )

  const chatsChart = !oneDay && (
    <ChartCard title="Chats handled per day" subtitle={k ? `${k.conversations} in total · ${k.resolved} resolved` : undefined} loading={loading}>
      <ColumnChart color={C.primary} height={170}
        data={daily.map(d => ({ label: dayLabel(d.date, days), title: `${dayTitle(d.date)} · ${d.resolved} resolved`, value: d.conversations }))}
        format={v => String(Math.round(v))} />
    </ChartCard>
  )
  const replyChart = !oneDay && (
    <ChartCard title="Reply time" subtitle="Median per day — lower is better" loading={loading}>
      <LineChart color={C.primary} height={170}
        data={daily.map(d => ({ label: dayLabel(d.date, days), title: dayTitle(d.date), value: d.replySec }))}
        format={v => duration(v)} />
    </ChartCard>
  )
  const peak = data ? data.byHour.indexOf(Math.max(...data.byHour)) : -1
  const hoursChart = (
    <ChartCard title="Busiest hours" subtitle={data && data.byHour.some(Boolean) ? `Messages sent by hour · peak around ${hourLabel(peak)}` : 'Messages sent by hour'} loading={loading}>
      <ColumnChart color={C.primary} height={150} labelEvery={6} empty={range === 'today' ? 'No messages sent yet today' : 'No messages in this period'}
        data={(data?.byHour ?? Array.from({ length: 24 }, () => 0)).map((v, h) => ({ label: hourLabel(h), title: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, value: v }))}
        format={v => String(Math.round(v))} />
    </ChartCard>
  )
  const channelTotal = data ? data.byChannel.whatsapp + data.byChannel.instagram + data.byChannel.webchat : 0
  const channelChart = (
    <ChartCard title="Chats by channel" loading={loading}>
      <View style={styles.donutRow}>
        <Donut size={124} thickness={15}
          segments={CHANNEL.map(c => ({ key: c.key, value: data?.byChannel[c.key] ?? 0, color: c.color }))}
          center={<View style={{ alignItems: 'center' }}><Txt style={styles.donutValue}>{channelTotal}</Txt><Txt style={styles.donutLabel}>chats</Txt></View>} />
        {/* Every slice labelled with its count and share — colour is never the only key. */}
        <View style={{ flex: 1, gap: 10 }}>
          {CHANNEL.map(c => {
            const v = data?.byChannel[c.key] ?? 0
            return (
              <View key={c.key} style={styles.legendRow}>
                <View style={[styles.legendSwatch, { backgroundColor: c.color }]} />
                <Txt style={styles.legendName}>{c.label}</Txt>
                <Txt style={styles.legendValue}>{v}</Txt>
                <Txt style={styles.legendPct}>{channelTotal ? `${Math.round((v / channelTotal) * 100)}%` : '—'}</Txt>
              </View>
            )
          })}
        </View>
      </View>
    </ChartCard>
  )

  const maxResolved = Math.max(1, ...(data?.team ?? []).map(u => u.resolved))
  const leaderboard = (
    <ChartCard title="Team leaderboard" subtitle="Resolved chats this period" icon={Trophy} loading={loading}>
      <View>
        <View style={styles.lbHead}>
          <Txt style={[styles.lbHeadText, { flex: 1 }]}>Agent</Txt>
          <Txt style={[styles.lbHeadText, { width: 64, textAlign: 'right' }]}>Resolved</Txt>
          <Txt style={[styles.lbHeadText, { width: 56, textAlign: 'right' }]}>Reply</Txt>
        </View>
        {(data?.team ?? []).map((u, i) => {
          const isMe = u.id === me.id
          const isViewed = u.id === data?.agent.id
          return (
            <Pressable key={u.id} disabled={!canPickAgent} onPress={() => { haptic(); setAgentId(u.id === me.id ? undefined : u.id) }}
              style={[styles.lbRow, isViewed && { backgroundColor: '#F5F8FF' }]} accessibilityLabel={`${i + 1}. ${u.name}: ${u.resolved} resolved, reply ${duration(u.replySec)}`}>
              <Txt style={[styles.rank, i < 3 && { color: C.ink }]}>{i + 1}</Txt>
              <Avatar label={u.initials} seed={u.id} size={28} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Txt style={styles.lbName} numberOfLines={1}>{u.name}{isMe ? ' (you)' : ''}</Txt>
                <Meter value={u.resolved} max={maxResolved} color={isViewed ? C.primary : '#93B8FF'} track={C.soft} />
              </View>
              <Txt style={[styles.lbNum, { width: 64 }]}>{u.resolved}</Txt>
              <Txt style={[styles.lbNum, { width: 56, color: C.muted, fontFamily: font.medium }]}>{duration(u.replySec)}</Txt>
            </Pressable>
          )
        })}
        {data && data.team.length === 0 && <Txt style={[styles.kpiSub, { padding: 12 }]}>No activity in this period yet.</Txt>}
      </View>
    </ChartCard>
  )

  return (
    <SafeAreaView edges={isWide ? [] : ['top']} style={{ flex: 1, backgroundColor: C.page }}>
      <ScrollView contentContainerStyle={[styles.page, isWide && styles.pageWide]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}>
        {header}
        <Segmented<AnalyticsRange>
          value={range}
          onChange={chooseRange}
          items={[{ key: 'today', label: 'Today' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }, { key: 'custom', label: 'Custom' }]}
        />
        {range === 'custom' && span && (
          <Pressable onPress={() => { haptic(); setSpanOpen(true) }} accessibilityRole="button" accessibilityLabel={`Showing ${formatSpan(span)}. Change dates`}
            style={(s) => [styles.spanChip, ((s as PressState).pressed || (s as PressState).hovered) && { borderColor: '#B9D0FF' }]}>
            <View style={styles.spanIcon}><CalendarRange size={14} color={C.primary} strokeWidth={2.2} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={styles.spanText} numberOfLines={1}>{formatSpan(span)}</Txt>
              <Txt style={styles.spanSub} numberOfLines={1}>{days === 1 ? '1 day · vs the day before' : `${days} days · vs the ${days} days before`}</Txt>
            </View>
            <View style={styles.spanEdit}>
              <Pencil size={11} color={C.primary} strokeWidth={2.4} />
              <Txt style={styles.spanEditText}>Change</Txt>
            </View>
          </Pressable>
        )}
        {error && <View style={styles.error}><Notice tone="danger" icon={WifiOff} text={error} action={{ label: 'Retry', onPress: refresh }} /></View>}
        {kpiGrid}
        {data && range !== 'today' && range !== 'custom' && <Txt style={styles.compare}>Changes compare with {periodName}.</Txt>}
        {wide ? (
          <>
            {!oneDay && <View style={styles.row2}><View style={styles.col}>{chatsChart}</View><View style={styles.col}>{replyChart}</View></View>}
            <View style={styles.row2}><View style={styles.col}>{hoursChart}</View><View style={styles.col}>{channelChart}</View></View>
            {leaderboard}
          </>
        ) : (
          <>
            {chatsChart}
            {replyChart}
            {hoursChart}
            {channelChart}
            {leaderboard}
          </>
        )}
      </ScrollView>

      <DateRangeSheet visible={spanOpen} value={range === 'custom' ? span : null} onClose={() => setSpanOpen(false)}
        onApply={(s) => { setSpanOpen(false); setSpan(s); setRange('custom') }} />

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="View analytics for" width={420}>
        {[...team].sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.name.localeCompare(b.name))).map(u => (
          <SheetRow key={u.id} left={<Avatar label={u.initials} seed={u.id} size={34} presence={u.presence} />}
            label={u.id === me.id ? `${u.name} (you)` : u.name} detail={u.role[0]!.toUpperCase() + u.role.slice(1)}
            selected={(data?.agent.id ?? me.id) === u.id}
            onPress={() => { setPickerOpen(false); setAgentId(u.id === me.id ? undefined : u.id) }} />
        ))}
      </Sheet>
    </SafeAreaView>
  )
}

function ChartCard({ title, subtitle, icon: Icon, loading, children }: { title: string; subtitle?: string; icon?: LucideIcon; loading?: boolean; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {Icon && <Icon size={14} color="#F59E0B" strokeWidth={2.2} />}
        <View style={{ flex: 1 }}>
          <Txt style={styles.cardTitle}>{title}</Txt>
          {subtitle && <Txt style={styles.cardSub}>{subtitle}</Txt>}
        </View>
      </View>
      <View style={loading ? { opacity: 0.5 } : undefined}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 14 },
  pageWide: { paddingHorizontal: 28, paddingTop: 24, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: C.ink },
  subtitle: { fontFamily: font.medium, fontSize: 11.5, lineHeight: 15, color: C.faint },
  agentPick: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingLeft: 6, paddingRight: 9, borderRadius: 99,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, maxWidth: 160,
  },
  agentPickText: { fontFamily: font.semibold, fontSize: 12, color: C.text, flexShrink: 1 },
  error: { borderRadius: 12, overflow: 'hidden' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: -6 },
  kpi: { padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, gap: 6 },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kpiLabel: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, color: C.muted, flexShrink: 1 },
  kpiMid: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  kpiValue: { fontFamily: font.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.6, color: C.ink },
  kpiBottom: { gap: 4 },
  kpiSub: { fontFamily: font.regular, fontSize: 10.5, lineHeight: 13, color: C.faint },
  delta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99 },
  deltaText: { fontFamily: font.bold, fontSize: 10, lineHeight: 13 },
  spanChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, marginTop: -4,
    borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: '#FFFFFF',
  },
  spanIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#EBF2FF', alignItems: 'center', justifyContent: 'center' },
  spanText: { fontFamily: font.bold, fontSize: 13, lineHeight: 17, color: C.ink },
  spanSub: { fontFamily: font.regular, fontSize: 10.5, lineHeight: 13, color: C.faint },
  spanEdit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 28, borderRadius: 99, backgroundColor: '#EBF2FF' },
  spanEditText: { fontFamily: font.semibold, fontSize: 11, color: C.primary },
  compare: { fontFamily: font.regular, fontSize: 10.5, color: C.faint, marginTop: -4 },
  card: { padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  cardTitle: { fontFamily: font.bold, fontSize: 13.5, lineHeight: 18, color: C.ink },
  cardSub: { fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: C.faint },
  row2: { flexDirection: 'row', gap: 14 },
  col: { flex: 1, minWidth: 0 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 4 },
  donutValue: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, color: C.ink },
  donutLabel: { fontFamily: font.medium, fontSize: 10, color: C.faint },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendName: { flex: 1, fontFamily: font.medium, fontSize: 12, color: C.text },
  legendValue: { fontFamily: font.bold, fontSize: 12, color: C.ink, fontVariant: ['tabular-nums'] },
  legendPct: { width: 36, textAlign: 'right', fontFamily: font.medium, fontSize: 11, color: C.muted, fontVariant: ['tabular-nums'] },
  lbHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6, paddingLeft: 66 },
  lbHeadText: { fontFamily: font.semibold, fontSize: 10, color: C.faint, letterSpacing: 0.3 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10 },
  rank: { width: 18, textAlign: 'center', fontFamily: font.bold, fontSize: 12, color: C.faint },
  lbName: { fontFamily: font.semibold, fontSize: 12.5, lineHeight: 16, color: C.text },
  lbNum: { textAlign: 'right', fontFamily: font.bold, fontSize: 12.5, color: C.ink, fontVariant: ['tabular-nums'] },
})
