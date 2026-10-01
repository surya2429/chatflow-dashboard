import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  AtSign, BellOff, BellRing, ChevronRight, Clock3, Coffee, Globe, Hourglass, Info, LogOut, Mail, MessageCircle, Moon, Phone,
  PhoneCall, Radio, Server, ShieldCheck, Smartphone, Sparkles, UserPlus, WifiOff, Zap, type LucideIcon,
} from 'lucide-react-native'
import { api, errorMessage, type AnalyticsKpis, type NotificationSettings, type NotifyCategory } from '@/lib/api'
import { useAuth, useUser } from '@/lib/auth'
import { API_URL } from '@/lib/config'
import { appVersion, getDeviceId } from '@/lib/device'
import { DEFAULT_FILTERS } from '@/lib/filters'
import { setPresence } from '@/lib/presence'
import { store, useStore } from '@/lib/store'
import { font, useLayout } from '@/lib/theme'
import type { Bot, Presence } from '@/lib/types'
import { notificationStatus, registerForPush, type NotificationStatus } from '@/push/push'
import { Avatar, BotAvatar, haptic, Skeleton, Toast, Txt } from '@/components/ui'

/**
 * Profile — who you are, whether you're taking chats, and your account.
 * Same page background and palette as Home and Analytics (the web dashboard's).
 */
const C = {
  primary: '#0066FF', ink: '#0F172A', text: '#1E293B', muted: '#64748B', faint: '#94A3B8', line: '#E2E8F0', soft: '#F1F5F9', page: '#F8FAFC',
  danger: '#DC2626', dangerBg: '#FEF2F2', dangerLine: '#FECACA',
}
const ROLE: Record<string, { label: string; bg: string; fg: string }> = {
  admin: { label: 'Admin', bg: '#F5F3FF', fg: '#6D28D9' },
  supervisor: { label: 'Supervisor', bg: '#EFF4FF', fg: '#0052CC' },
  agent: { label: 'Agent', bg: '#F1F5F9', fg: '#334155' },
}
const STATUS: { key: Presence; label: string; detail: string; dot: string; icon: LucideIcon; tint: string }[] = [
  { key: 'online', label: 'Online', detail: 'New chats come to you, with notifications', dot: '#10B981', icon: Zap, tint: '#ECFDF5' },
  { key: 'away', label: 'Away', detail: 'No new chats — you keep the ones you have', dot: '#F59E0B', icon: Coffee, tint: '#FFFBEB' },
  { key: 'offline', label: 'Offline', detail: 'Off shift — nothing is routed to you', dot: '#94A3B8', icon: Moon, tint: '#F1F5F9' },
]
type PressState = { pressed: boolean; hovered?: boolean }

// What each switch means, in the words an agent would use.
const CATEGORIES: { key: NotifyCategory; label: string; detail: string; icon: LucideIcon; color: string; tint: string }[] = [
  { key: 'assignments', label: 'Chats assigned to me', detail: 'A customer is handed to you', icon: UserPlus, color: '#0066FF', tint: '#EBF2FF' },
  { key: 'messages', label: 'New messages', detail: 'Customers reply in your chats', icon: MessageCircle, color: '#047857', tint: '#ECFDF5' },
  { key: 'waiting', label: 'Waiting queue', detail: 'A chat is waiting for an agent', icon: Hourglass, color: '#B45309', tint: '#FFFBEB' },
  { key: 'calls', label: 'Calls', detail: 'Voice and video calls from your website', icon: PhoneCall, color: '#6D28D9', tint: '#F5F3FF' },
]

function duration(sec: number | null) {
  if (sec === null) return '—'
  if (sec < 60) return `${Math.round(sec)}s`
  const m = sec / 60
  return m < 60 ? `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}m` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`
}

export default function Profile() {
  const me = useUser()
  const { signOut } = useAuth()
  const { isWide, contentWidth } = useLayout()
  const bots = useStore(s => s.bots)
  const connection = useStore(s => s.connection)
  const [week, setWeek] = useState<AnalyticsKpis | null>(null)
  const [notif, setNotif] = useState<NotificationStatus | null>(null)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null)
  const [notifBusy, setNotifBusy] = useState(false)
  const [busy, setBusy] = useState<Presence | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [toast, setToast] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null)

  useFocusEffect(useCallback(() => {
    let live = true
    api.agentAnalytics('7d').then(a => { if (live) setWeek(a.kpis) }).catch(() => {})
    notificationStatus().then(s => { if (live) setNotif(s) }).catch(() => { if (live) setNotif('unavailable') })
    getDeviceId().then(id => api.notificationSettings(id)).then(s => { if (live) setNotifSettings(s) }).catch(() => {})
    return () => { live = false }
  }, []))

  // Coming back from the system Settings app: the permission may have changed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') notificationStatus().then(setNotif).catch(() => {})
    })
    return () => sub.remove()
  }, [])

  const choose = async (p: Presence) => {
    if (p === me.presence || busy) return
    haptic()
    setBusy(p)
    try {
      const n = await setPresence(p)
      setToast({ text: n > 0 ? `You’re ${p} — ${n} waiting ${n === 1 ? 'chat' : 'chats'} assigned to you` : `You’re ${p}`, tone: 'success' })
    } catch (err) {
      setToast({ text: errorMessage(err), tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  /** This phone's master switch: asks the OS first if it has to, then tells the server. */
  const toggleDevice = async (on: boolean) => {
    haptic()
    if (on && notif === 'denied') { void Linking.openSettings(); return }
    setNotifBusy(true)
    try {
      if (on && (notif !== 'granted' || !notifSettings?.device)) {
        const ok = await registerForPush()
        setNotif(ok ? 'granted' : await notificationStatus())
        if (!ok) return
      }
      setNotifSettings(cur => cur && { ...cur, device: { registered: true, ...cur.device, pushEnabled: on } })
      setNotifSettings(await api.updateNotificationSettings({ deviceId: await getDeviceId(), pushEnabled: on }))
      setToast({ text: on ? 'Notifications are on for this phone' : 'This phone won’t notify you', tone: 'success' })
    } catch (err) {
      setToast({ text: errorMessage(err), tone: 'danger' })
      getDeviceId().then(id => api.notificationSettings(id)).then(setNotifSettings).catch(() => {})
    } finally {
      setNotifBusy(false)
    }
  }

  const toggleCategory = async (key: NotifyCategory, on: boolean) => {
    haptic()
    const before = notifSettings
    setNotifSettings(cur => cur && { ...cur, categories: { ...cur.categories, [key]: on } })
    try {
      const next = await api.updateNotificationSettings({ categories: { [key]: on } })
      setNotifSettings(cur => cur && { ...cur, categories: next.categories })
    } catch (err) {
      setNotifSettings(before)
      setToast({ text: errorMessage(err), tone: 'danger' })
    }
  }

  const confirmSignOut = () => {
    const go = () => { setSigningOut(true); void signOut() }
    if (Platform.OS === 'web') { go(); return }
    Alert.alert('Sign out?', 'You’ll stop receiving chats and notifications on this phone.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: go },
    ])
  }

  const live = connection === 'live'
  const role = ROLE[me.role] ?? ROLE.agent!
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')
  const twoColumn = isWide && contentWidth >= 900

  // ── Sections ───────────────────────────────────────────────────────────────

  const identity = (
    <View style={styles.idCard}>
      <View style={styles.idBand} />
      <View style={styles.idBody}>
        <View style={styles.idTop}>
          <View style={styles.avatarRing}><Avatar label={me.initials} seed={me.id} size={64} presence={me.presence} /></View>
          <View style={[styles.connection, { backgroundColor: live ? '#ECFDF5' : '#FFFBEB' }]}>
            {live ? <Radio size={11} color="#047857" strokeWidth={2.4} /> : <WifiOff size={11} color="#B45309" strokeWidth={2.4} />}
            <Txt style={[styles.connectionText, { color: live ? '#047857' : '#B45309' }]}>{live ? 'Connected' : 'Reconnecting…'}</Txt>
          </View>
        </View>
        <Txt style={styles.name} numberOfLines={1}>{me.name}</Txt>
        <View style={styles.emailRow}>
          <Mail size={12} color={C.faint} strokeWidth={2} />
          <Txt style={styles.email} numberOfLines={1}>{me.email}</Txt>
        </View>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: role.bg }]}>
            <ShieldCheck size={11} color={role.fg} strokeWidth={2.4} />
            <Txt style={[styles.badgeText, { color: role.fg }]}>{role.label}</Txt>
          </View>
          <View style={[styles.badge, { backgroundColor: C.soft }]}>
            <View style={[styles.dot, { backgroundColor: STATUS.find(s => s.key === me.presence)!.dot }]} />
            <Txt style={[styles.badgeText, { color: C.text }]}>{STATUS.find(s => s.key === me.presence)!.label}</Txt>
          </View>
        </View>

        {/* This week, at a glance */}
        <Pressable onPress={() => { haptic(); router.navigate('/analytics') }} accessibilityRole="button" accessibilityLabel="This week. Open analytics"
          style={(s) => [styles.week, ((s as PressState).hovered || (s as PressState).pressed) && { borderColor: '#B9D0FF' }]}>
          <View style={styles.weekHead}>
            <Sparkles size={12} color={C.primary} strokeWidth={2.4} />
            <Txt style={styles.weekTitle}>This week</Txt>
            <View style={{ flex: 1 }} />
            <Txt style={styles.weekLink}>Analytics</Txt>
            <ChevronRight size={13} color={C.primary} strokeWidth={2.4} />
          </View>
          <View style={styles.weekStats}>
            <WeekStat label="Chats" value={week ? String(week.conversations) : null} />
            <View style={styles.weekDivider} />
            <WeekStat label="Resolved" value={week ? String(week.resolved) : null} />
            <View style={styles.weekDivider} />
            <WeekStat label="Reply time" value={week ? duration(week.replySec) : null} />
          </View>
        </Pressable>
      </View>
    </View>
  )

  // Wide: three descriptive cards. Narrow: three compact cards in a row, with
  // the chosen one's meaning spelled out once underneath.
  const roomy = twoColumn || contentWidth >= 520
  const current = STATUS.find(s => s.key === me.presence)!
  const availability = (
    <Section title="Availability" subtitle="Decides which chats are routed to you">
      <View style={styles.statusGrid}>
        {STATUS.map(s => {
          const on = me.presence === s.key
          return (
            <Pressable key={s.key} onPress={() => { void choose(s.key) }} accessibilityRole="radio" aria-checked={on} accessibilityLabel={`${s.label}. ${s.detail}`}
              style={(st) => [styles.statusCard, !roomy && styles.statusCompact, on && styles.statusOn,
                !on && ((st as PressState).hovered || (st as PressState).pressed) && { borderColor: '#CBD5E1' }]}>
              <View style={[styles.statusTop, !roomy && { marginBottom: 8 }]}>
                <View style={[styles.statusIcon, { backgroundColor: s.tint }]}><s.icon size={15} color={s.dot} strokeWidth={2.2} /></View>
                <View style={[styles.radio, on && styles.radioOn]}>
                  {busy === s.key ? <ActivityIndicator size="small" color={C.primary} /> : on && <View style={styles.radioDot} />}
                </View>
              </View>
              <Txt style={styles.statusLabel}>{s.label}</Txt>
              {roomy && <Txt style={styles.statusDetail}>{s.detail}</Txt>}
            </Pressable>
          )
        })}
      </View>
      {!roomy && (
        <View style={styles.statusHint}>
          <View style={[styles.dot, { backgroundColor: current.dot }]} />
          <Txt style={styles.statusDetail}>{current.detail}</Txt>
        </View>
      )}
    </Section>
  )

  const notifRow = (
    <Section title="Notifications" subtitle="What reaches you when the app is closed">
      <NotificationPrefs status={notif} settings={notifSettings} busy={notifBusy} onToggleDevice={toggleDevice} onToggleCategory={toggleCategory} />
    </Section>
  )

  const botsSection = (
    <Section title={me.role === 'agent' ? 'Your bots' : 'Bots in this workspace'} subtitle="Their chats show up in your inbox" count={bots.length}>
      <View style={styles.card}>
        {bots.length === 0 && (
          <View style={styles.row}><Txt style={styles.rowSub}>You’re not on any bot yet — ask an admin to add you.</Txt></View>
        )}
        {bots.map((b, i) => <BotRow key={b.id} bot={b} first={i === 0} />)}
      </View>
    </Section>
  )

  const account = (
    <Section title="Account & app">
      <View style={styles.card}>
        <InfoRow icon={Mail} label="Email" value={me.email ?? '—'} first />
        <InfoRow icon={ShieldCheck} label="Role" value={role.label} />
        <InfoRow icon={Clock3} label="Time zone" value={tz} />
        <InfoRow icon={Server} label="Server" value={API_URL.replace(/^https?:\/\//, '')} />
        <InfoRow icon={Info} label="Version" value={appVersion} />
      </View>
      <Pressable onPress={confirmSignOut} disabled={signingOut} accessibilityRole="button" accessibilityLabel="Sign out"
        style={(s) => [styles.signOut, ((s as PressState).hovered || (s as PressState).pressed) && { backgroundColor: '#FEE2E2' }]}>
        {signingOut ? <ActivityIndicator size="small" color={C.danger} /> : <LogOut size={15} color={C.danger} strokeWidth={2.2} />}
        <Txt style={styles.signOutText}>Sign out</Txt>
      </Pressable>
    </Section>
  )

  return (
    <SafeAreaView edges={isWide ? [] : ['top']} style={{ flex: 1, backgroundColor: C.page }}>
      <ScrollView contentContainerStyle={[styles.page, isWide && styles.pageWide]} showsVerticalScrollIndicator={false}>
        <View>
          <Txt style={styles.title}>Profile</Txt>
          <Txt style={styles.subtitle}>Your account, availability and bots</Txt>
        </View>
        {twoColumn ? (
          <View style={styles.columns}>
            <View style={{ width: 340, gap: 18 }}>{identity}{notifRow}</View>
            <View style={{ flex: 1, gap: 18, minWidth: 0 }}>{availability}{botsSection}{account}</View>
          </View>
        ) : (
          <>
            {identity}
            {availability}
            {notifRow}
            {botsSection}
            {account}
          </>
        )}
      </ScrollView>
      <Toast text={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </SafeAreaView>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ title, subtitle, count, children }: { title: string; subtitle?: string; count?: number; children: ReactNode }) {
  return (
    <View style={{ gap: 9 }}>
      <View>
        <View style={styles.sectionHead}>
          <Txt style={styles.sectionTitle}>{title}</Txt>
          {count !== undefined && <View style={styles.countPill}><Txt style={styles.countText}>{count}</Txt></View>}
        </View>
        {subtitle && <Txt style={styles.sectionSub}>{subtitle}</Txt>}
      </View>
      {children}
    </View>
  )
}

function NotificationPrefs({ status, settings, busy, onToggleDevice, onToggleCategory }: {
  status: NotificationStatus | null
  settings: NotificationSettings | null
  busy: boolean
  onToggleDevice: (on: boolean) => void
  onToggleCategory: (key: NotifyCategory, on: boolean) => void
}) {
  const available = status !== null && status !== 'unavailable'
  const phoneOn = status === 'granted' && settings?.device?.pushEnabled !== false
  const enabledCount = settings ? CATEGORIES.filter(c => settings.categories[c.key]).length : 0
  const sub = status === null ? 'Checking…'
    : status === 'unavailable' ? (Platform.OS === 'web' ? 'Not available in the browser — use the mobile app' : 'Not available on this device')
      : status === 'denied' ? 'Blocked in system settings — tap to open them'
        : status === 'undetermined' ? 'Turn on to hear about chats when the app is closed'
          : phoneOn ? 'Alerts reach this phone even when the app is closed'
            : 'Off — this phone stays silent; chats still show in the app'

  return (
    <View style={styles.card}>
      {/* This phone */}
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: phoneOn ? '#ECFDF5' : status === 'denied' ? C.dangerBg : C.soft }]}>
          {phoneOn ? <BellRing size={15} color="#047857" strokeWidth={2.2} /> : <BellOff size={15} color={status === 'denied' ? C.danger : C.muted} strokeWidth={2.2} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={styles.rowTitle}>Push notifications on this {Platform.OS === 'web' ? 'device' : 'phone'}</Txt>
          <Txt style={[styles.rowSub, status === 'denied' && { color: C.danger }]}>{sub}</Txt>
        </View>
        {busy ? <ActivityIndicator size="small" color={C.primary} style={{ width: 40 }} />
          : status === 'denied' ? (
            <Pressable onPress={() => onToggleDevice(true)} accessibilityRole="button" style={styles.smallBtn}>
              <Txt style={styles.smallBtnText}>Open Settings</Txt>
            </Pressable>
          ) : (
            <Switch value={phoneOn} disabled={!available} onValueChange={onToggleDevice} accessibilityLabel="Push notifications on this phone"
              trackColor={{ true: C.primary, false: '#E2E8F0' }} thumbColor="#FFFFFF" ios_backgroundColor="#E2E8F0"
              {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})} />
          )}
      </View>

      {/* What to be told about — follows the person to every device */}
      <View style={[styles.divider, styles.prefsHead]}>
        <Txt style={styles.prefsLabel}>NOTIFY ME ABOUT</Txt>
        <View style={{ flex: 1 }} />
        {settings && <Txt style={styles.prefsCount}>{enabledCount} of {CATEGORIES.length} on</Txt>}
      </View>
      {CATEGORIES.map(c => {
        const on = settings?.categories[c.key] ?? true
        return (
          <View key={c.key} style={[styles.row, styles.prefRow, !phoneOn && available && { opacity: 0.6 }]}>
            <View style={[styles.rowIcon, { backgroundColor: on ? c.tint : C.soft }]}><c.icon size={15} color={on ? c.color : C.faint} strokeWidth={2.2} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt style={styles.rowTitle}>{c.label}</Txt>
              <Txt style={styles.rowSub}>{c.detail}</Txt>
            </View>
            {settings ? (
              <Switch value={on} onValueChange={v => onToggleCategory(c.key, v)} accessibilityLabel={c.label}
                trackColor={{ true: C.primary, false: '#E2E8F0' }} thumbColor="#FFFFFF" ios_backgroundColor="#E2E8F0"
                {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})} />
            ) : <Skeleton w={36} h={20} r={10} />}
          </View>
        )
      })}
      <View style={styles.prefsFoot}>
        <Smartphone size={11} color={C.faint} strokeWidth={2.2} />
        <Txt style={styles.prefsFootText}>These choices apply on every device you sign in on. Call cancellations always come through.</Txt>
      </View>
    </View>
  )
}

function WeekStat({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.weekStat}>
      {value === null ? <Skeleton w={28} h={16} /> : <Txt style={styles.weekValue}>{value}</Txt>}
      <Txt style={styles.weekLabel}>{label}</Txt>
    </View>
  )
}

function InfoRow({ icon: Icon, label, value, first }: { icon: LucideIcon; label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.rowIcon}><Icon size={15} color={C.muted} strokeWidth={2} /></View>
      <Txt style={[styles.rowTitle, { flex: 1 }]}>{label}</Txt>
      <Txt style={styles.infoValue} numberOfLines={1}>{value}</Txt>
    </View>
  )
}

function BotRow({ bot, first }: { bot: Bot; first: boolean }) {
  const paused = bot.status === 'paused'
  const Icon = bot.channel === 'whatsapp' ? Phone : bot.channel === 'instagram' ? AtSign : Globe
  return (
    <Pressable onPress={() => { haptic(); store.setFilters({ ...DEFAULT_FILTERS, botIds: [bot.id] }); router.navigate('/conversations') }}
      accessibilityRole="button" accessibilityLabel={`${bot.name}, ${bot.stats.open} open. Open chats`}
      style={(s) => [styles.row, !first && styles.divider, ((s as PressState).hovered || (s as PressState).pressed) && { backgroundColor: C.page }]}>
      <BotAvatar name={bot.name} color={bot.color} channel={bot.channel} size={34} off={paused} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.rowTitle} numberOfLines={1}>{bot.name}</Txt>
        <View style={styles.botLine}>
          <Icon size={10} color="#CBD5E1" strokeWidth={2.2} />
          <Txt style={styles.rowSub} numberOfLines={1}>{bot.identity}</Txt>
        </View>
      </View>
      {paused
        ? <View style={[styles.badge, { backgroundColor: '#FFFBEB' }]}><Txt style={[styles.badgeText, { color: '#B45309' }]}>Paused</Txt></View>
        : <View style={{ alignItems: 'flex-end' }}><Txt style={styles.botOpen}>{bot.stats.open}</Txt><Txt style={styles.botOpenLabel}>open</Txt></View>}
      <ChevronRight size={15} color="#CBD5E1" strokeWidth={2.2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 18 },
  pageWide: { paddingHorizontal: 28, paddingTop: 24, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: C.ink },
  subtitle: { fontFamily: font.medium, fontSize: 11.5, lineHeight: 15, color: C.faint },
  // Identity
  idCard: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  idBand: { height: 64, backgroundColor: C.primary },
  idBody: { paddingHorizontal: 16, paddingBottom: 16, marginTop: -34 },
  idTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  avatarRing: { padding: 3, borderRadius: 99, backgroundColor: '#FFFFFF' },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginBottom: 6 },
  connectionText: { fontFamily: font.semibold, fontSize: 10.5, lineHeight: 13 },
  name: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: C.ink, marginTop: 10 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  email: { flexShrink: 1, fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: C.muted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontFamily: font.semibold, fontSize: 10.5, lineHeight: 13 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  week: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.page, padding: 12, gap: 10 },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weekTitle: { fontFamily: font.bold, fontSize: 12, color: C.ink },
  weekLink: { fontFamily: font.semibold, fontSize: 11.5, color: C.primary },
  weekStats: { flexDirection: 'row', alignItems: 'center' },
  weekStat: { flex: 1, alignItems: 'center', gap: 2 },
  weekValue: { fontFamily: font.bold, fontSize: 16, lineHeight: 20, color: C.ink },
  weekLabel: { fontFamily: font.medium, fontSize: 10, lineHeight: 12, color: C.faint },
  weekDivider: { width: 1, height: 24, backgroundColor: C.line },
  // Availability
  statusGrid: { flexDirection: 'row', gap: 8 },
  statusCard: { flex: 1, padding: 12, gap: 3, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: '#FFFFFF' },
  statusCompact: { padding: 10 },
  statusHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  statusOn: { borderColor: C.primary, backgroundColor: '#FBFCFF' },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statusIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  statusLabel: { fontFamily: font.bold, fontSize: 13, lineHeight: 17, color: C.ink },
  statusDetail: { fontFamily: font.regular, fontSize: 11, lineHeight: 15, color: C.muted },
  // Sections & rows
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontFamily: font.bold, fontSize: 14.5, lineHeight: 19, letterSpacing: -0.2, color: C.ink },
  sectionSub: { fontFamily: font.regular, fontSize: 11.5, lineHeight: 15, color: C.faint, marginTop: 1 },
  countPill: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99, backgroundColor: C.soft },
  countText: { fontFamily: font.semibold, fontSize: 10.5, lineHeight: 14, color: C.muted },
  card: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  rowIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: font.semibold, fontSize: 12.5, lineHeight: 16, color: C.text },
  rowSub: { flexShrink: 1, fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: C.muted },
  infoValue: { maxWidth: '55%', fontFamily: font.medium, fontSize: 12, color: C.muted },
  prefsHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 2, backgroundColor: '#FFFFFF' },
  prefsLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 0.6, color: C.faint },
  prefsCount: { fontFamily: font.semibold, fontSize: 10.5, color: C.muted },
  prefRow: { paddingVertical: 9 },
  prefsFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  prefsFootText: { flex: 1, fontFamily: font.regular, fontSize: 10.5, lineHeight: 14, color: C.faint },
  smallBtn: { paddingHorizontal: 11, height: 30, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontFamily: font.semibold, fontSize: 11.5, color: '#FFFFFF' },
  botLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  botOpen: { fontFamily: font.bold, fontSize: 13, lineHeight: 16, color: C.ink },
  botOpenLabel: { fontFamily: font.medium, fontSize: 9.5, lineHeight: 11, color: C.faint },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 12,
    backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerLine, marginTop: 4,
  },
  signOutText: { fontFamily: font.semibold, fontSize: 13, color: C.danger },
})
