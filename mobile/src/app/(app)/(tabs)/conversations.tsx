import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Archive, ChevronDown, CircleCheck, Coffee, Funnel, Hand, Inbox as InboxIcon, Layers, MailOpen, MessagesSquare, Moon, SlidersHorizontal, SquarePen,
  Star, WifiOff,
} from 'lucide-react-native'
import { api, errorMessage } from '@/lib/api'
import { useUser } from '@/lib/auth'
import { activeChips, clearRefinements, compare, matches, SORT_LABEL, toParams, type Filters, type QuickView } from '@/lib/filters'
import { setPresence } from '@/lib/presence'
import { store, useStore } from '@/lib/store'
import { font, radius, shadow, space, theme as t, useLayout } from '@/lib/theme'
import type { Conversation } from '@/lib/types'
import { ConversationRow, ConversationRowSkeleton } from '@/components/ConversationRow'
import { ContactDetails } from '@/components/ContactDetails'
import { FilterSheet } from '@/components/FilterSheet'
import { ConversationView, NoConversationSelected } from '@/components/thread/ConversationView'
import {
  Avatar, Badge, ChannelMark, Chip, EmptyState, haptic, IconButton, identityText, Notice, SearchField, Sheet, SheetRow, STROKE, Toast, Txt,
} from '@/components/ui'

export default function Inbox() {
  const me = useUser()
  const { width, height, isWide, isXL } = useLayout()
  const shortScreen = !isWide && height < 520
  const filters = useStore(s => s.filters)
  const bots = useStore(s => s.bots)
  const team = useStore(s => s.team)
  const conversations = useStore(s => s.conversations)
  const resyncToken = useStore(s => s.resyncToken)
  const setFilters = (next: Filters | ((f: Filters) => Filters)) => store.setFilters(next)

  const [ids, setIds] = useState<string[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [quick, setQuick] = useState<Conversation | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [search, setSearch] = useState(filters.q)
  const requestSeq = useRef(0)

  useEffect(() => {
    const h = setTimeout(() => store.setFilters(f => (f.q === search ? f : { ...f, q: search })), 300)
    return () => clearTimeout(h)
  }, [search])

  const queryKey = `${JSON.stringify(filters)}#${resyncToken}`
  const loading = loadedKey !== queryKey && !error
  const singleBot = filters.botIds.length === 1 ? filters.botIds[0] : undefined

  useEffect(() => {
    const seq = ++requestSeq.current
    Promise.all([
      api.conversations({ ...toParams(filters), limit: 30 }),
      api.counts({ botId: singleBot, channel: filters.channels.length === 1 ? filters.channels[0] : undefined }).catch(() => null),
    ]).then(([page, c]) => {
      if (seq !== requestSeq.current) return
      store.upsertConversations(page.items)
      setIds(page.items.map(x => x.id))
      setCursor(page.nextCursor)
      if (c) setCounts(c)
      setError(null)
    }).catch((err) => {
      if (seq === requestSeq.current) setError(errorMessage(err))
    }).finally(() => {
      if (seq === requestSeq.current) { setLoadedKey(queryKey); setRefreshing(false) }
    })
  }, [filters, queryKey, refreshNonce, singleBot])
  const refresh = () => { setRefreshing(true); setRefreshNonce(n => n + 1) }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await api.conversations({ ...toParams(filters), cursor, limit: 30 })
      store.upsertConversations(page.items)
      setIds(prev => [...prev, ...page.items.map(x => x.id).filter(id => !prev.includes(id))])
      setCursor(page.nextCursor)
    } catch { /* next scroll retries */ } finally {
      setLoadingMore(false)
    }
  }

  const rows = useMemo(() => {
    const set = new Set(ids)
    for (const c of Object.values(conversations)) if (matches(c, filters, me.id)) set.add(c.id)
    return [...set]
      .map(id => conversations[id])
      .filter((c): c is NonNullable<typeof c> => !!c && matches(c, filters, me.id))
      .sort(compare(filters.sort))
  }, [ids, conversations, filters, me.id])

  // On wide screens, keep something open: the first chat, until the agent picks one.
  const current = isWide ? (selected && conversations[selected] ? selected : rows[0]?.id ?? null) : null

  const knownLabels = useMemo(() => {
    const s = new Set<string>()
    for (const c of Object.values(conversations)) c.labels.forEach(l => s.add(l))
    return [...s].sort()
  }, [conversations])

  const chips = activeChips(filters, bots, team).filter(c => !c.key.startsWith('bot:'))
  const filterCount = chips.length + (filters.sort !== 'recent' ? 1 : 0)
  const anyFilter = chips.length > 0 || filters.view !== 'all' || !!filters.q

  const open = (c: Conversation) => {
    if (isWide) setSelected(c.id)
    else router.push({ pathname: '/conversation/[id]', params: { id: c.id } })
  }

  const quickAct = async (fn: () => Promise<Conversation>, done: string) => {
    setQuick(null)
    try { store.upsertConversations([await fn()]); setToast(done) } catch (err) { setToast(errorMessage(err)) }
  }
  const rowActions = (c: Conversation) => ({
    onResolve: () => { void quickAct(() => api.resolve(c.id), 'Resolved') },
    onArchive: () => { void quickAct(() => api.archive(c.id, !c.archived), c.archived ? 'Moved to inbox' : 'Archived') },
    onStar: () => { void quickAct(() => api.star(c.id, !c.starred), c.starred ? 'Star removed' : 'Starred') },
    onMarkRead: () => { void quickAct(() => api.markRead(c.id), 'Marked as read') },
  })

  const views: { key: QuickView; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine', count: counts.mine },
    { key: 'unassigned', label: 'Unassigned', count: counts.unassigned },
    { key: 'waiting', label: 'Waiting', count: counts.waiting },
  ]

  const scopeBot = filters.botIds.length === 1 ? bots.find(b => b.id === filters.botIds[0]) : undefined
  const scopeLabel = filters.botIds.length === 0 ? 'All bots' : scopeBot?.name ?? `${filters.botIds.length} bots`
  const pickScope = (botIds: string[]) => { haptic(); setScopeOpen(false); setFilters(f => ({ ...f, botIds })) }

  // Three short rows: title + bot switcher · search with filters inside · view pills.
  const header = (
    <>
      <View style={styles.titleRow}>
        <Txt style={styles.title}>Inbox</Txt>
        {bots.length > 1 && (
          <Pressable onPress={() => { haptic(); setScopeOpen(true) }} accessibilityRole="button" accessibilityLabel={`Showing ${scopeLabel}. Change bot`}
            style={({ pressed }) => [styles.scope, pressed && { backgroundColor: t.surfaceSunken }]}>
            {scopeBot ? <View style={[styles.scopeDot, { backgroundColor: scopeBot.color }]} /> : <Layers size={13} color={t.textMuted} strokeWidth={STROKE} />}
            <Txt v="smallMedium" numberOfLines={1} style={{ maxWidth: 150, fontFamily: font.semibold }}>{scopeLabel}</Txt>
            <ChevronDown size={14} color={t.textMuted} strokeWidth={2} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {isWide && <IconButton icon={SquarePen} variant="primary" label="New conversation" onPress={() => router.push('/new')} size={16} box={32} />}
      </View>
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search chats"
        style={styles.search}
        trailing={
          <Pressable onPress={() => { haptic(); setFilterOpen(true) }} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={`Filter and sort${filterCount ? `, ${filterCount} active` : ''}`} style={styles.filterBtn}>
            <SlidersHorizontal size={16} color={filterCount ? t.primary : t.textMuted} strokeWidth={STROKE} />
            {filterCount > 0 && <View style={styles.filterBadge}><Txt style={styles.filterBadgeText}>{filterCount}</Txt></View>}
          </Pressable>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.views} style={{ flexGrow: 0 }}>
        {views.map(v => (
          <Chip key={v.key} label={v.label} count={v.count} active={filters.view === v.key} onPress={() => setFilters(f => ({ ...f, view: v.key }))} />
        ))}
      </ScrollView>

      {(chips.length > 0 || filters.sort !== 'recent') && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {filters.sort !== 'recent' && <Badge label={SORT_LABEL[filters.sort]} tone="gray" onRemove={() => setFilters(f => ({ ...f, sort: 'recent' }))} />}
          {chips.map(c => <Badge key={c.key} label={c.label} tone="blue" onRemove={() => setFilters(c.clear)} />)}
          <Pressable onPress={() => setFilters(f => ({ ...clearRefinements(f), sort: 'recent' }))} hitSlop={8} accessibilityRole="button">
            <Txt v="caption" color={t.textMuted} style={{ fontFamily: font.semibold }}>Clear all</Txt>
          </Pressable>
        </ScrollView>
      )}

      <View style={styles.divider} />
    </>
  )

  const list = (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      {!shortScreen && header}
      {me.presence !== 'online' && (
        <Notice tone={me.presence === 'offline' ? 'neutral' : 'warning'} icon={me.presence === 'offline' ? Moon : Coffee}
          text={me.presence === 'offline' ? 'You’re offline — no new chats' : 'You’re away — no new chats assigned'}
          action={{ label: 'Go online', onPress: () => { void setPresence('online').catch(() => {}) } }} />
      )}
      {error && <Notice tone="danger" icon={WifiOff} text={error} action={{ label: 'Retry', onPress: refresh }} />}

      <FlatList
        data={loading && rows.length === 0 ? [] : rows}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <ConversationRow c={item} meId={me.id} showBot={filters.botIds.length !== 1} selected={isWide && item.id === current}
            onPress={() => open(item)} onLongPress={() => setQuick(item)} actions={rowActions(item)} />
        )}
        style={{ flex: 1 }}
        ListHeaderComponent={shortScreen ? header : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={loading
          ? <View>{Array.from({ length: 7 }, (_, i) => <ConversationRowSkeleton key={i} />)}</View>
          : <EmptyState
              icon={anyFilter ? Funnel : InboxIcon}
              title={anyFilter ? 'Nothing matches' : 'You’re all caught up'}
              body={anyFilter ? 'Try another view, or clear your filters.' : 'New chats on your bots will land here in real time.'}
              action={anyFilter ? { label: 'Clear filters', onPress: () => { setSearch(''); setFilters(f => ({ ...clearRefinements(f), view: 'all', q: '' })) } } : undefined}
            />}
        ListFooterComponent={loadingMore ? <ConversationRowSkeleton /> : <View style={{ height: isWide ? space.xl : 84 }} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      {!isWide && (
        <Pressable onPress={() => { haptic(); router.push('/new') }} accessibilityRole="button" accessibilityLabel="New conversation"
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }], backgroundColor: t.primaryHover }]}>
          <SquarePen size={21} color="#FFFFFF" strokeWidth={2.1} />
        </Pressable>
      )}
      {!isWide && <Toast text={toast} onHide={() => setToast(null)} />}
    </View>
  )

  const currentConv = current ? conversations[current] : null
  const showDetails = isXL && detailsOpen && !!currentConv

  return (
    <SafeAreaView edges={isWide ? [] : ['top']} style={{ flex: 1, backgroundColor: t.surface }}>
      {isWide ? (
        <View style={styles.split}>
          <View style={[styles.listPane, { width: width < 1024 ? 320 : isXL ? 380 : 340 }]}>{list}</View>
          <View style={{ flex: 1 }}>
            {current
              ? <ConversationView key={current} id={current} embedded detailsOpen={showDetails} onToggleDetails={isXL ? () => setDetailsOpen(v => !v) : undefined} />
              : <NoConversationSelected />}
          </View>
          {showDetails && (
            <View style={styles.detailsPane}>
              <ContactDetails key={currentConv.contactId} contactId={currentConv.contactId} currentConversationId={currentConv.id} onClose={() => setDetailsOpen(false)} />
            </View>
          )}
          <Toast text={toast} onHide={() => setToast(null)} />
        </View>
      ) : list}

      <Sheet visible={scopeOpen} onClose={() => setScopeOpen(false)} title="Show chats from" width={440}>
        <SheetRow icon={Layers} label="All bots" detail={`${bots.length} bots · ${bots.reduce((n, b) => n + b.stats.open, 0)} open`}
          selected={filters.botIds.length === 0} onPress={() => pickScope([])} />
        {bots.map(b => (
          <SheetRow key={b.id} left={<ChannelMark channel={b.channel} size={34} color={b.color} />} label={b.name}
            detail={`${b.identity} · ${b.stats.open} open`}
            right={b.stats.unread > 0 ? <Badge label={`${b.stats.unread} new`} tone="blue" /> : undefined}
            selected={filters.botIds.length === 1 && filters.botIds[0] === b.id} onPress={() => pickScope([b.id])} />
        ))}
      </Sheet>

      <FilterSheet key={String(filterOpen)} visible={filterOpen} value={filters} knownLabels={knownLabels} onApply={setFilters} onClose={() => setFilterOpen(false)} />

      <Sheet visible={!!quick} onClose={() => setQuick(null)} title={quick?.name} subtitle={quick ? [identityText(quick.identity, quick.channel), quick.botName].filter(Boolean).join(' · ') : undefined}>
        {quick && (
          <>
            <View style={styles.quickPreview}>
              <Avatar label={quick.avatar} seed={quick.contactId} channel={quick.channel} size={34} />
              <Txt v="small" color={t.textSoft} numberOfLines={2} style={{ flex: 1 }}>{quick.lastMessage}</Txt>
            </View>
            <SheetRow icon={MessagesSquare} iconBg={t.primarySoft} iconColor={t.primary} label="Open conversation" onPress={() => { const c = quick; setQuick(null); open(c) }} />
            {!(quick.status === 'agent' && quick.agentId === me.id) && (
              <SheetRow icon={Hand} label={quick.status === 'resolved' ? 'Reopen & take over' : 'Take over'}
                onPress={() => quickAct(() => api.takeover(quick.id), 'You’re now handling this chat')} />
            )}
            <SheetRow icon={Star} iconColor={quick.starred ? '#F59E0B' : undefined} label={quick.starred ? 'Remove star' : 'Star'} onPress={rowActions(quick).onStar} />
            {quick.unread > 0 && <SheetRow icon={MailOpen} label="Mark as read" onPress={rowActions(quick).onMarkRead} />}
            <SheetRow icon={Archive} label={quick.archived ? 'Move to inbox' : 'Archive'} onPress={rowActions(quick).onArchive} />
            {quick.status !== 'resolved' && (
              <SheetRow icon={CircleCheck} iconBg={t.successSoft} iconColor={t.success} label="Mark as resolved" onPress={rowActions(quick).onResolve} />
            )}
          </>
        )}
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 46, paddingHorizontal: space.lg },
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5, color: t.text },
  scope: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingLeft: 9, paddingRight: 7, borderRadius: radius.pill,
    backgroundColor: t.surfaceAlt, flexShrink: 1,
  },
  scopeDot: { width: 8, height: 8, borderRadius: 4 },
  search: { marginHorizontal: space.lg },
  filterBtn: { width: 30, height: 30, marginRight: -6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  filterBadge: {
    position: 'absolute', top: 1, right: 1, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: t.surfaceAlt,
  },
  filterBadgeText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 9, lineHeight: 11 },
  views: { gap: 6, paddingHorizontal: space.lg, paddingTop: 10, paddingBottom: 10 },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg, width: 54, height: 54, borderRadius: 18, backgroundColor: t.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.button, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  chips: { gap: 6, paddingHorizontal: space.lg, paddingBottom: 10, alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border },
  split: { flex: 1, flexDirection: 'row' },
  listPane: { width: 340, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.border },
  detailsPane: { width: 320, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.border },
  quickPreview: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.xl, marginBottom: space.sm, padding: space.md, borderRadius: 12, backgroundColor: t.surfaceAlt },
})
