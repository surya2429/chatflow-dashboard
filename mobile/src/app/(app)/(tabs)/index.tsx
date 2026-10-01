import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import {
  AtSign, BotOff, ChevronRight, CircleCheckBig, Coffee, Globe, Hourglass, Inbox, MailOpen, MessagesSquare, Moon, Phone,
  SquarePen, Zap, type LucideIcon,
} from 'lucide-react-native'
import { api, errorMessage } from '@/lib/api'
import { useUser } from '@/lib/auth'
import { listTime } from '@/lib/format'
import { DEFAULT_FILTERS, type Filters } from '@/lib/filters'
import { setPresence } from '@/lib/presence'
import { store, useStore } from '@/lib/store'
import { font, useLayout } from '@/lib/theme'
import type { Bot, Conversation, Presence } from '@/lib/types'
import { Avatar, BotAvatar, haptic, Skeleton, Toast, Txt } from '@/components/ui'

/**
 * Home — "what needs me right now", in the dashboard's palette:
 *   queue card (status · my open chats · resolved ring · pick up next)
 *   → customers waiting → my recent chats → bots → team.
 */
const C = {
  primary: '#0066FF', primaryDeep: '#0052CC', ink: '#0F172A', text: '#1E293B', muted: '#64748B', faint: '#94A3B8',
  line: '#E2E8F0', soft: '#F1F5F9', page: '#F8FAFC', green: '#10B981', amber: '#F59E0B', amberInk: '#B45309', violet: '#7C3AED',
}
const PRESENCE: { key: Presence; label: string; dot: string }[] = [
  { key: 'online', label: 'Online', dot: '#34D399' },
  { key: 'away', label: 'Away', dot: '#FBBF24' },
  { key: 'offline', label: 'Offline', dot: '#CBD5E1' },
]

type PressState = { pressed: boolean; hovered?: boolean }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function openInbox(patch: Partial<Filters>) {
  store.setFilters({ ...DEFAULT_FILTERS, ...patch })
  router.navigate('/conversations')
}

function openConversation(id: string) {
  haptic()
  router.push({ pathname: '/conversation/[id]', params: { id } })
}

export default function Home() {
  const me = useUser()
  const bots = useStore(s => s.bots)
  const team = useStore(s => s.team)
  const conversations = useStore(s => s.conversations)
  const { isWide, contentWidth } = useLayout()
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(bots.length > 0)
  const [picking, setPicking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [b, waiting, mine] = await Promise.all([
      api.bots().catch(() => null),
      api.conversations({ sort: 'waiting', limit: 40 }).catch(() => null),
      api.conversations({ view: 'mine', limit: 8 }).catch(() => null),
    ])
    if (b) store.setBots(b.items)
    store.upsertConversations([...(waiting?.items ?? []), ...(mine?.items ?? [])])
    setLoaded(true)
  }, [])
  useFocusEffect(useCallback(() => { void load() }, [load]))
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const totals = useMemo(() => bots.reduce(
    (a, b) => ({
      mine: a.mine + b.stats.mine, waiting: a.waiting + b.stats.waiting, unassigned: a.unassigned + b.stats.unassigned,
      unread: a.unread + b.stats.unread, resolved: a.resolved + b.stats.resolvedToday, open: a.open + b.stats.open,
    }),
    { mine: 0, waiting: 0, unassigned: 0, unread: 0, resolved: 0, open: 0 },
  ), [bots])

  const all = useMemo(() => Object.values(conversations).filter(c => !c.archived), [conversations])
  const queue = useMemo(() => all
    .filter(c => c.status !== 'resolved' && (c.waitingSince || (c.agentId === me.id && c.unread > 0)))
    .sort((a, b) => (a.waitingSince && !b.waitingSince ? -1 : !a.waitingSince && b.waitingSince ? 1
      : (a.waitingSince ?? b.timestamp) < (b.waitingSince ?? a.timestamp) ? -1 : 1))
    .slice(0, 8), [all, me.id])
  const myChats = useMemo(() => all
    .filter(c => c.agentId === me.id && c.status === 'agent')
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 4), [all, me.id])
  const teamSorted = useMemo(() => {
    const order = { online: 0, away: 1, offline: 2 }
    return [...team].sort((a, b) => order[a.presence] - order[b.presence] || a.name.localeCompare(b.name))
  }, [team])

  // Take the longest-waiting customer and open the chat.
  const pickUpNext = async () => {
    if (picking) return
    haptic()
    setPicking(true)
    try {
      const next = (await api.conversations({ view: 'waiting', sort: 'waiting', limit: 1 })).items[0]
      if (!next) { setToast('Nobody is waiting right now'); return }
      store.upsertConversations([await api.takeover(next.id)])
      openConversation(next.id)
    } catch (err) {
      setToast(errorMessage(err))
    } finally {
      setPicking(false)
    }
  }

  const changePresence = (p: Presence) => {
    if (p === me.presence) return
    haptic()
    setPresence(p).catch(err => setToast(errorMessage(err)))
  }

  const firstName = me.name.split(' ')[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const twoColumn = isWide && contentWidth >= 960

  // ── Pieces ─────────────────────────────────────────────────────────────────

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel="Profile">
        <Avatar label={me.initials} seed={me.id} size={isWide ? 44 : 40} presence={me.presence} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.date}>{today}</Txt>
        <Txt style={[styles.hello, isWide && { fontSize: 22, lineHeight: 28 }]} numberOfLines={1}>{greeting()}, {firstName}</Txt>
      </View>
      <Pressable onPress={() => { haptic(); router.push('/new') }} accessibilityRole="button" accessibilityLabel="New conversation"
        style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}>
        <SquarePen size={16} color="#FFFFFF" strokeWidth={2.2} />
        {isWide && <Txt style={styles.newBtnText}>New conversation</Txt>}
      </Pressable>
    </View>
  )

  const resolvedShare = totals.resolved + totals.mine > 0 ? totals.resolved / (totals.resolved + totals.mine) : 0
  const hero = (
    <View style={styles.hero}>
      <View style={styles.status} accessibilityRole="tablist">
        {PRESENCE.map(p => {
          const on = me.presence === p.key
          return (
            <Pressable key={p.key} onPress={() => changePresence(p.key)} accessibilityRole="tab" aria-selected={on}
              accessibilityLabel={`Set status: ${p.label}`} style={[styles.statusItem, on && styles.statusOn]}>
              <View style={[styles.statusDot, { backgroundColor: p.dot }]} />
              <Txt style={[styles.statusText, on && { color: C.primary }]}>{p.label}</Txt>
            </Pressable>
          )
        })}
      </View>

      <Pressable onPress={() => { haptic(); openInbox({ view: 'mine' }) }} accessibilityRole="button"
        accessibilityLabel={`${totals.mine} chats in your queue. Open`} style={styles.heroMain}>
        <View style={{ flex: 1 }}>
          <Txt style={styles.heroValue}>{loaded ? totals.mine : '–'}</Txt>
          <Txt style={styles.heroLabel}>{totals.mine === 1 ? 'chat' : 'chats'} assigned to you</Txt>
        </View>
        <Ring progress={resolvedShare} value={totals.resolved} label="resolved" />
      </Pressable>

      <View style={styles.tiles}>
        <HeroTile icon={Hourglass} value={totals.waiting} label="Waiting" alert={totals.waiting > 0} onPress={() => openInbox({ view: 'waiting' })} />
        <HeroTile icon={Inbox} value={totals.unassigned} label="Unassigned" onPress={() => openInbox({ view: 'unassigned' })} />
        <HeroTile icon={MailOpen} value={totals.unread} label="Unread" onPress={() => openInbox({ unread: true })} />
      </View>

      {totals.waiting > 0 ? (
        <Pressable onPress={pickUpNext} accessibilityRole="button" accessibilityLabel="Pick up the next waiting chat"
          style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.9 }]}>
          {picking ? <ActivityIndicator size="small" color={C.primary} /> : <Zap size={15} color={C.primary} fill={C.primary} strokeWidth={2} />}
          <Txt style={styles.pickText}>Pick up next chat</Txt>
          <View style={styles.pickCount}><Txt style={styles.pickCountText}>{totals.waiting} waiting</Txt></View>
        </Pressable>
      ) : (
        <View style={styles.caughtUp}>
          <CircleCheckBig size={14} color="#A7F3D0" strokeWidth={2.2} />
          <Txt style={styles.caughtUpText}>All caught up — nobody is waiting</Txt>
        </View>
      )}
    </View>
  )

  const awayNotice = me.presence !== 'online' && (
    <Pressable onPress={() => changePresence('online')} accessibilityRole="button" style={styles.notice}>
      {me.presence === 'away' ? <Coffee size={14} color={C.amberInk} strokeWidth={2} /> : <Moon size={14} color={C.muted} strokeWidth={2} />}
      <Txt style={[styles.noticeText, me.presence === 'offline' && { color: C.muted }]}>
        {me.presence === 'away' ? 'You’re away — new chats won’t be assigned to you' : 'You’re offline — nothing is routed to you'}
      </Txt>
      <Txt style={styles.noticeAction}>Go online</Txt>
    </Pressable>
  )

  const queueSection = (
    <Section title="Waiting for a reply" count={queue.length} action={queue.length ? { label: 'See all', onPress: () => openInbox({ sort: 'waiting' }) } : undefined}>
      {!loaded ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {[0, 1].map(i => <View key={i} style={styles.queueCard}><Skeleton w={120} h={12} /><Skeleton w={170} h={10} style={{ marginTop: 10 }} /></View>)}
        </ScrollView>
      ) : queue.length === 0 ? (
        <View style={styles.emptyRow}>
          <View style={[styles.emptyIcon, { backgroundColor: '#ECFDF5' }]}><CircleCheckBig size={16} color={C.green} strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}>
            <Txt style={styles.rowTitle}>Nobody is waiting</Txt>
            <Txt style={styles.rowSub}>New customers who ask for a person show up here.</Txt>
          </View>
        </View>
      ) : twoColumn ? (
        <View style={styles.card}>{queue.slice(0, 5).map((c, i) => <QueueRow key={c.id} c={c} first={i === 0} />)}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {queue.map(c => <QueueCard key={c.id} c={c} />)}
        </ScrollView>
      )}
    </Section>
  )

  const myChatsSection = (
    <Section title="My chats" count={totals.mine} action={{ label: 'Open inbox', onPress: () => openInbox({ view: 'mine' }) }}>
      <View style={styles.card}>
        {!loaded && [0, 1, 2].map(i => (
          <View key={i} style={[styles.chatRow, i > 0 && styles.divider]}><Skeleton w={38} h={38} r={19} /><View style={{ flex: 1, gap: 6 }}><Skeleton w="50%" h={11} /><Skeleton w="80%" h={9} /></View></View>
        ))}
        {loaded && myChats.length === 0 && (
          <View style={styles.emptyRow}>
            <View style={[styles.emptyIcon, { backgroundColor: '#EFF4FF' }]}><MessagesSquare size={16} color={C.primary} strokeWidth={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Txt style={styles.rowTitle}>No open chats</Txt>
              <Txt style={styles.rowSub}>Chats assigned to you will appear here.</Txt>
            </View>
          </View>
        )}
        {myChats.map((c, i) => <ChatRow key={c.id} c={c} first={i === 0} />)}
      </View>
    </Section>
  )

  const botsSection = (
    <Section title="Your bots" count={bots.length} action={bots.length ? { label: 'All chats', onPress: () => openInbox({}) } : undefined}>
      {loaded && bots.length === 0 ? (
        <View style={[styles.card, styles.emptyRow]}>
          <View style={[styles.emptyIcon, { backgroundColor: C.soft }]}><BotOff size={16} color={C.muted} strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}>
            <Txt style={styles.rowTitle}>No bots yet</Txt>
            <Txt style={styles.rowSub}>Ask an admin to add you to a bot.</Txt>
          </View>
        </View>
      ) : twoColumn ? (
        <View style={styles.botGrid}>{bots.map(b => <View key={b.id} style={styles.botGridItem}><BotCard bot={b} /></View>)}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {!loaded && [0, 1, 2].map(i => <View key={i} style={styles.botCard}><Skeleton w={36} h={36} r={18} /><Skeleton w={90} h={11} style={{ marginTop: 10 }} /></View>)}
          {bots.map(b => <View key={b.id} style={{ width: 168 }}><BotCard bot={b} /></View>)}
        </ScrollView>
      )}
    </Section>
  )

  const teamSection = team.length > 0 && (
    <Section title="Team" count={team.filter(u => u.presence === 'online').length} countLabel="online">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.hScroll, { gap: 14 }]}>
        {teamSorted.map(u => (
          <View key={u.id} style={styles.member}>
            <Avatar label={u.initials} seed={u.id} size={44} presence={u.presence} />
            <Txt style={styles.memberName} numberOfLines={1}>{u.id === me.id ? 'You' : u.name.split(' ')[0]}</Txt>
            <Txt style={[styles.memberRole, u.presence === 'online' && { color: C.green }]}>{u.presence === 'online' ? 'Online' : u.role[0]!.toUpperCase() + u.role.slice(1)}</Txt>
          </View>
        ))}
      </ScrollView>
    </Section>
  )

  return (
    <SafeAreaView edges={isWide ? [] : ['top']} style={{ flex: 1, backgroundColor: C.page }}>
      <ScrollView
        contentContainerStyle={[styles.page, isWide && styles.pageWide]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {header}
        {awayNotice}
        {twoColumn ? (
          <View style={styles.columns}>
            <View style={{ flex: 1.15, gap: 20, minWidth: 0 }}>{hero}{botsSection}</View>
            <View style={{ flex: 1, gap: 20, minWidth: 0 }}>{queueSection}{myChatsSection}{teamSection}</View>
          </View>
        ) : (
          <>
            {hero}
            {queueSection}
            {myChatsSection}
            {botsSection}
            {teamSection}
          </>
        )}
      </ScrollView>
      <Toast text={toast} onHide={() => setToast(null)} />
    </SafeAreaView>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ title, count, countLabel, action, children }: {
  title: string; count?: number; countLabel?: string; action?: { label: string; onPress: () => void }; children: ReactNode
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <Txt style={styles.sectionTitle}>{title}</Txt>
        {count !== undefined && (
          <View style={styles.countPill}><Txt style={styles.countText}>{count}{countLabel ? ` ${countLabel}` : ''}</Txt></View>
        )}
        <View style={{ flex: 1 }} />
        {action && (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={styles.sectionAction}>
            <Txt style={styles.sectionActionText}>{action.label}</Txt>
            <ChevronRight size={13} color={C.primary} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  )
}

/** Share of today's work that's done: resolved ÷ (resolved + still open). */
function Ring({ progress, value, label }: { progress: number; value: number; label: string }) {
  const size = 64
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${value} ${label} today`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#FFFFFF" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - Math.min(1, Math.max(0, progress)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Txt style={styles.ringValue}>{value}</Txt>
      <Txt style={styles.ringLabel}>{label}</Txt>
    </View>
  )
}

function HeroTile({ icon: Icon, value, label, alert, onPress }: { icon: LucideIcon; value: number; label: string; alert?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button" accessibilityLabel={`${value} ${label}. Open`}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
      <View style={styles.tileTop}>
        <Icon size={13} color={alert ? '#FDE68A' : 'rgba(255,255,255,0.8)'} strokeWidth={2.2} />
        <Txt style={styles.tileValue}>{value}</Txt>
      </View>
      <Txt style={styles.tileLabel}>{label}</Txt>
    </Pressable>
  )
}

function ChannelIcon({ channel, size = 10, color = C.faint }: { channel: Conversation['channel']; size?: number; color?: string }) {
  if (channel === 'whatsapp') return <Phone size={size} color={color} strokeWidth={2.2} />
  if (channel === 'instagram') return <AtSign size={size} color={color} strokeWidth={2.2} />
  return <Globe size={size} color={color} strokeWidth={2.2} />
}

function QueueCard({ c }: { c: Conversation }) {
  const waiting = !!c.waitingSince
  return (
    <Pressable onPress={() => openConversation(c.id)} accessibilityRole="button" accessibilityLabel={`${c.name}. ${waiting ? 'Waiting' : `${c.unread} new`}. Open`}
      style={(s) => [styles.queueCard, waiting && styles.queueCardWaiting, ((s as PressState).pressed || (s as PressState).hovered) && { borderColor: '#B9D0FF' }]}>
      <View style={styles.queueTop}>
        <Avatar label={c.avatar} seed={c.contactId} size={34} channel={c.channel} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt style={styles.rowTitle} numberOfLines={1}>{c.name}</Txt>
          <Txt style={styles.rowSub} numberOfLines={1}>{c.botName ?? ''}</Txt>
        </View>
      </View>
      <Txt style={styles.queueMsg} numberOfLines={2}>{c.lastMessage}</Txt>
      <View style={[styles.chip, { backgroundColor: waiting ? '#FFFBEB' : '#EFF4FF', borderColor: waiting ? '#FDE68A' : '#DCE8FF' }]}>
        {waiting ? <Hourglass size={10} color={C.amberInk} strokeWidth={2.4} /> : <MailOpen size={10} color={C.primary} strokeWidth={2.4} />}
        <Txt style={[styles.chipText, { color: waiting ? C.amberInk : C.primary }]}>
          {waiting ? `Waiting ${listTime(c.waitingSince!)}` : `${c.unread} new`}
        </Txt>
      </View>
    </Pressable>
  )
}

function QueueRow({ c, first }: { c: Conversation; first: boolean }) {
  const waiting = !!c.waitingSince
  return (
    <Pressable onPress={() => openConversation(c.id)} accessibilityRole="button"
      style={(s) => [styles.chatRow, !first && styles.divider, ((s as PressState).pressed || (s as PressState).hovered) && { backgroundColor: C.page }]}>
      <Avatar label={c.avatar} seed={c.contactId} size={38} channel={c.channel} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.rowTitle} numberOfLines={1}>{c.name}</Txt>
        <Txt style={styles.rowSub} numberOfLines={1}>{c.lastMessage}</Txt>
      </View>
      <View style={[styles.chip, { backgroundColor: waiting ? '#FFFBEB' : '#EFF4FF', borderColor: waiting ? '#FDE68A' : '#DCE8FF' }]}>
        <Txt style={[styles.chipText, { color: waiting ? C.amberInk : C.primary }]}>{waiting ? listTime(c.waitingSince!) : `${c.unread} new`}</Txt>
      </View>
    </Pressable>
  )
}

function ChatRow({ c, first }: { c: Conversation; first: boolean }) {
  const unread = c.unread > 0
  return (
    <Pressable onPress={() => openConversation(c.id)} accessibilityRole="button" accessibilityLabel={`${c.name}${unread ? `, ${c.unread} unread` : ''}. Open`}
      style={(s) => [styles.chatRow, !first && styles.divider, ((s as PressState).pressed || (s as PressState).hovered) && { backgroundColor: C.page }]}>
      <Avatar label={c.avatar} seed={c.contactId} size={38} channel={c.channel} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.chatTop}>
          <Txt style={[styles.rowTitle, { flex: 1 }, unread && { fontFamily: font.bold }]} numberOfLines={1}>{c.name}</Txt>
          <Txt style={[styles.time, unread && { color: C.primary, fontFamily: font.semibold }]}>{listTime(c.timestamp)}</Txt>
        </View>
        <View style={styles.chatTop}>
          <ChannelIcon channel={c.channel} />
          <Txt style={[styles.rowSub, { flex: 1 }, unread && { color: C.text }]} numberOfLines={1}>{c.lastMessage}</Txt>
          {unread && <View style={styles.unread}><Txt style={styles.unreadText}>{c.unread}</Txt></View>}
        </View>
      </View>
    </Pressable>
  )
}

function BotCard({ bot }: { bot: Bot }) {
  const s = bot.stats
  const paused = bot.status === 'paused'
  const total = Math.max(1, s.open)
  const other = Math.max(0, s.open - s.mine - s.unassigned)
  return (
    <Pressable onPress={() => { haptic(); openInbox({ botIds: [bot.id] }) }} accessibilityRole="button" accessibilityLabel={`${bot.name}, ${s.open} open. Open chats`}
      style={(st) => [styles.botCard, ((st as PressState).pressed || (st as PressState).hovered) && { borderColor: '#B9D0FF' }]}>
      <View style={styles.botTop}>
        <BotAvatar name={bot.name} color={bot.color} channel={bot.channel} size={36} off={paused} />
        <View style={[styles.statePill, { backgroundColor: paused ? '#FFFBEB' : '#ECFDF5' }]}>
          <View style={[styles.statusDot, { backgroundColor: paused ? '#FBBF24' : '#34D399' }]} />
          <Txt style={[styles.stateText, { color: paused ? C.amberInk : '#047857' }]}>{paused ? 'Paused' : 'Active'}</Txt>
        </View>
      </View>
      <Txt style={styles.botName} numberOfLines={1}>{bot.name}</Txt>
      <View style={styles.chatTop}>
        <ChannelIcon channel={bot.channel} size={9} color="#CBD5E1" />
        <Txt style={styles.botIdentity} numberOfLines={1}>{bot.identity}</Txt>
      </View>
      <View style={styles.botNumbers}>
        <Txt style={styles.botOpen}>{s.open}</Txt>
        <Txt style={styles.botOpenLabel}>open</Txt>
        {s.waiting > 0 && <Txt style={[styles.botOpenLabel, { color: C.amberInk, marginLeft: 'auto' }]}>{s.waiting} waiting</Txt>}
      </View>
      {/* Who holds the open chats: you · unassigned · teammates/bot */}
      <View style={styles.bar}>
        {s.mine > 0 && <View style={{ flex: s.mine / total, backgroundColor: C.green }} />}
        {s.unassigned > 0 && <View style={{ flex: s.unassigned / total, backgroundColor: C.violet }} />}
        {other > 0 && <View style={{ flex: other / total, backgroundColor: '#CBD5E1' }} />}
        {s.open === 0 && <View style={{ flex: 1, backgroundColor: C.soft }} />}
      </View>
      <View style={styles.legend}>
        <Legend color={C.green} label={`${s.mine} yours`} />
        <Legend color={C.violet} label={`${s.unassigned} free`} />
      </View>
    </Pressable>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Txt style={styles.legendText}>{label}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 20 },
  pageWide: { paddingHorizontal: 28, paddingTop: 24, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, color: C.faint },
  hello: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, letterSpacing: -0.4, color: C.ink },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, minWidth: 38, paddingHorizontal: 11, borderRadius: 12,
    backgroundColor: C.primary, justifyContent: 'center',
  },
  newBtnText: { fontFamily: font.semibold, fontSize: 12.5, color: '#FFFFFF' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', marginTop: -6,
  },
  noticeText: { flex: 1, fontFamily: font.medium, fontSize: 11.5, lineHeight: 15, color: C.amberInk },
  noticeAction: { fontFamily: font.bold, fontSize: 11.5, color: C.primary },
  // Hero
  hero: { borderRadius: 20, backgroundColor: C.primary, padding: 14, gap: 14 },
  status: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  statusItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 30, borderRadius: 9 },
  statusOn: { backgroundColor: '#FFFFFF' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: font.semibold, fontSize: 11.5, lineHeight: 14, color: 'rgba(255,255,255,0.9)' },
  heroMain: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  heroValue: { fontFamily: font.bold, fontSize: 38, lineHeight: 42, letterSpacing: -1.2, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroLabel: { fontFamily: font.medium, fontSize: 12, lineHeight: 15, color: 'rgba(255,255,255,0.82)' },
  ringValue: { fontFamily: font.bold, fontSize: 15, lineHeight: 17, color: '#FFFFFF' },
  ringLabel: { fontFamily: font.medium, fontSize: 8.5, lineHeight: 10, color: 'rgba(255,255,255,0.8)' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.13)', gap: 2 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileValue: { fontFamily: font.bold, fontSize: 15, lineHeight: 18, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  tileLabel: { fontFamily: font.medium, fontSize: 10.5, lineHeight: 13, color: 'rgba(255,255,255,0.78)' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF' },
  pickText: { flex: 1, fontFamily: font.bold, fontSize: 13, color: C.primary },
  pickCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: '#FFFBEB' },
  pickCountText: { fontFamily: font.semibold, fontSize: 10.5, color: C.amberInk },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 },
  caughtUpText: { fontFamily: font.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' },
  // Sections
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontFamily: font.bold, fontSize: 14.5, lineHeight: 19, letterSpacing: -0.2, color: C.ink },
  countPill: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 99, backgroundColor: C.soft },
  countText: { fontFamily: font.semibold, fontSize: 10.5, lineHeight: 14, color: C.muted },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontFamily: font.semibold, fontSize: 12, color: C.primary },
  card: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  hScroll: { gap: 10, paddingRight: 4 },
  // Queue
  queueCard: { width: 236, padding: 12, gap: 8, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line },
  queueCardWaiting: { borderColor: '#FDE68A' },
  queueTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  queueMsg: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: C.muted, minHeight: 32 },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  chipText: { fontFamily: font.semibold, fontSize: 10.5, lineHeight: 13 },
  // Rows
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  chatTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowTitle: { fontFamily: font.semibold, fontSize: 13, lineHeight: 17, color: C.text },
  rowSub: { fontFamily: font.regular, fontSize: 11.5, lineHeight: 15, color: C.muted },
  time: { fontFamily: font.medium, fontSize: 10.5, color: C.faint },
  unread: { minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 5, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontFamily: font.bold, fontSize: 9.5, color: '#FFFFFF' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  emptyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // Bots
  botGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  botGridItem: { width: '50%', padding: 5 },
  botCard: { padding: 12, gap: 4, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line },
  botTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  stateText: { fontFamily: font.semibold, fontSize: 9.5, lineHeight: 12 },
  botName: { fontFamily: font.semibold, fontSize: 13, lineHeight: 17, color: C.text },
  botIdentity: { flexShrink: 1, fontFamily: font.regular, fontSize: 10.5, lineHeight: 13, color: C.faint },
  botNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  botOpen: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, letterSpacing: -0.5, color: C.ink, fontVariant: ['tabular-nums'] },
  botOpenLabel: { fontFamily: font.medium, fontSize: 10.5, color: C.faint },
  bar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: C.soft, gap: 2, marginTop: 4 },
  legend: { flexDirection: 'row', gap: 10, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: font.medium, fontSize: 10, color: C.muted },
  // Team
  member: { width: 58, alignItems: 'center', gap: 3 },
  memberName: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, color: C.text, marginTop: 3 },
  memberRole: { fontFamily: font.medium, fontSize: 9.5, lineHeight: 12, color: C.faint },
})
