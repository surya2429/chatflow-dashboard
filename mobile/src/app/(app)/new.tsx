import { useEffect, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { ArrowRight, Check, ChevronRight, CircleAlert, Globe, Info, Phone, Send, UserRound, Users, BotOff } from 'lucide-react-native'
import { api, errorMessage } from '@/lib/api'
import { useStore } from '@/lib/store'
import { font, radius, space, theme as t, type } from '@/lib/theme'
import type { Contact } from '@/lib/types'
import {
  Avatar, BrandGlyph, Button, ChannelMark, EmptyState, haptic, Notice, SearchField, Skeleton, STROKE, Txt,
} from '@/components/ui'
import { TemplatePicker } from '@/components/thread/TemplatePicker'

type PressState = { pressed: boolean; hovered?: boolean }
const web = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={[styles.stepNum, done && { backgroundColor: t.primary, borderColor: t.primary }]}>
          {done ? <Check size={12} color="#fff" strokeWidth={3} /> : <Txt v="caption" color={t.textMuted} style={{ fontFamily: font.bold }}>{n}</Txt>}
        </View>
        <Txt v="subheading">{title}</Txt>
      </View>
      {children}
    </View>
  )
}

/**
 * Starting a conversation follows each channel's rule:
 *   WhatsApp  — only with an approved template (the business can't free-type first).
 *   Instagram — only with an existing follower.
 *   Website   — visitor-initiated only; nobody to reach until they open the widget.
 */
export default function NewConversation() {
  const [channel, setChannel] = useState<'whatsapp' | 'instagram'>('whatsapp')
  // Which of my bots it starts from — its number / account is what the customer sees.
  const bots = useStore(s => s.bots)
  const channelBots = bots.filter(b => b.channel === channel && b.status === 'active')
  const [pickedBot, setPickedBot] = useState<string | null>(null)
  const botId = channelBots.find(b => b.id === pickedBot)?.id ?? channelBots[0]?.id
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [pickTemplate, setPickTemplate] = useState(false)
  const [followers, setFollowers] = useState<Contact[] | null>(null)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Contact | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (channel !== 'instagram') return undefined
    const h = setTimeout(() => {
      api.instagramFollowers(query || undefined).then(r => setFollowers(r.items)).catch(err => setError(errorMessage(err)))
    }, 250)
    return () => clearTimeout(h)
  }, [channel, query])

  const open = (conversationId: string) => router.replace({ pathname: '/conversation/[id]', params: { id: conversationId } })

  const startInstagram = async () => {
    if (!chosen || !text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.startInstagram({ contactId: chosen.id, text: text.trim(), clientMsgId: randomUUID(), botId })
      open(r.conversationId)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const phoneOk = phone.replace(/\D/g, '').length >= 8

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {/* Channel */}
      <View style={styles.channels}>
        {(['whatsapp', 'instagram'] as const).map(ch => {
          const on = channel === ch
          return (
            <Pressable key={ch} onPress={() => { haptic(); setChannel(ch); setError(null); setPickedBot(null) }} accessibilityRole="radio" aria-checked={on}
              style={(s) => [styles.channelCard, on && styles.cardOn, (s as PressState).hovered && !on && { borderColor: t.borderStrong }]}>
              <View style={styles.channelTop}>
                <View style={[styles.channelLogo, { backgroundColor: t.channel[ch] }]}><BrandGlyph channel={ch} size={18} /></View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              </View>
              <Txt v="subheading">{ch === 'whatsapp' ? 'WhatsApp' : 'Instagram'}</Txt>
              <Txt v="caption" color={t.textMuted} numberOfLines={1}>{ch === 'whatsapp' ? 'Any number, via template' : 'Message a follower'}</Txt>
            </Pressable>
          )
        })}
      </View>

      {error && <View style={styles.notice}><Notice tone="danger" icon={CircleAlert} text={error} /></View>}

      <Step n={1} title="Send from" done={!!botId}>
        {channelBots.length === 0 ? (
          <View style={styles.notice}>
            <Notice tone="warning" icon={BotOff} text={`You’re not on an active ${channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'} bot.`} />
          </View>
        ) : (
          <View style={styles.card}>
            {channelBots.map((b, i) => {
              const on = b.id === botId
              return (
                <Pressable key={b.id} onPress={() => { haptic(); setPickedBot(b.id) }} accessibilityRole="radio" aria-checked={on}
                  style={(s) => [styles.row, i > 0 && styles.divider, ((s as PressState).hovered || (s as PressState).pressed) && { backgroundColor: t.surfaceHover }]}>
                  <ChannelMark channel={b.channel} size={36} color={b.color} />
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyMedium">{b.name}</Txt>
                    <Txt v="small" color={t.textMuted}>{b.identity}</Txt>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </Pressable>
              )
            })}
          </View>
        )}
      </Step>

      {channel === 'whatsapp' ? (
        <Step n={2} title="Customer" done={phoneOk && !!name.trim()}>
          <View style={styles.card}>
            <View style={[styles.field, focus === 'phone' && styles.fieldFocus]}>
              <Phone size={17} color={focus === 'phone' ? t.primary : t.textMuted} strokeWidth={STROKE} />
              <TextInput value={phone} onChangeText={setPhone} placeholder="WhatsApp number, e.g. +91 98765 43210" placeholderTextColor={t.textFaint}
                onFocus={() => setFocus('phone')} onBlur={() => setFocus(null)}
                keyboardType="phone-pad" style={[type.body, styles.input, web]} accessibilityLabel="WhatsApp number" autoComplete="tel" />
            </View>
            <View style={[styles.field, styles.divider, focus === 'name' && styles.fieldFocus]}>
              <UserRound size={17} color={focus === 'name' ? t.primary : t.textMuted} strokeWidth={STROKE} />
              <TextInput value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={t.textFaint}
                onFocus={() => setFocus('name')} onBlur={() => setFocus(null)}
                style={[type.body, styles.input, web]} accessibilityLabel="Customer name" />
            </View>
          </View>
          <View style={styles.explain}>
            <Info size={15} color={t.textMuted} strokeWidth={STROKE} />
            <Txt v="small" color={t.textMuted} style={{ flex: 1 }}>
              WhatsApp only lets a business start a chat with an approved template. Their reply opens a 24-hour window for normal messages.
            </Txt>
          </View>
          <Button title="Choose a template" iconRight={ArrowRight} size="lg" onPress={() => setPickTemplate(true)} disabled={!phoneOk || !name.trim() || !botId} />
          <TemplatePicker
            visible={pickTemplate}
            onClose={() => setPickTemplate(false)}
            contactName={name}
            sendLabel="Send & start chat"
            onSend={async (tpl, variables) => {
              const r = await api.startWhatsApp({ phone, name: name.trim(), templateId: tpl.id, variables, clientMsgId: randomUUID(), botId })
              open(r.conversationId)
            }}
          />
        </Step>
      ) : chosen ? (
        <Step n={2} title="Message" done={!!text.trim()}>
          <View style={styles.card}>
            <View style={styles.row}>
              <Avatar label={chosen.avatar ?? chosen.name.slice(0, 2)} seed={chosen.id} size={38} channel="instagram" />
              <View style={{ flex: 1 }}>
                <Txt v="bodyMedium">{chosen.name}</Txt>
                <Txt v="small" color={t.textMuted}>{chosen.handle}</Txt>
              </View>
              <Button title="Change" kind="ghost" size="sm" onPress={() => setChosen(null)} />
            </View>
            <TextInput value={text} onChangeText={setText} placeholder="Write your first message…" placeholderTextColor={t.textFaint}
              multiline style={[type.body, styles.message, styles.divider, web]} accessibilityLabel="First message" />
          </View>
          <Button title="Send DM" icon={Send} size="lg" onPress={startInstagram} loading={busy} disabled={!text.trim() || !botId} style={{ marginTop: space.md }} />
        </Step>
      ) : (
        <Step n={2} title="Choose a follower">
          <SearchField value={query} onChangeText={setQuery} placeholder="Search followers" />
          <View style={[styles.card, { marginTop: space.sm }]}>
            {!followers && (
              <View style={{ padding: space.lg, gap: space.lg }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                    <Skeleton w={38} h={38} r={19} /><View style={{ gap: 6, flex: 1 }}><Skeleton w="45%" h={12} /><Skeleton w="30%" h={10} /></View>
                  </View>
                ))}
              </View>
            )}
            {followers?.length === 0 && <EmptyState icon={Users} title="No followers to message" body="Everyone who follows you already has an open chat." />}
            {followers?.map((f, i) => (
              <Pressable key={f.id} onPress={() => { haptic(); setChosen(f) }} accessibilityRole="button"
                style={(s) => [styles.row, i > 0 && styles.divider, ((s as PressState).hovered || (s as PressState).pressed) && { backgroundColor: t.surfaceHover }]}>
                <Avatar label={f.avatar ?? f.name.slice(0, 2)} seed={f.id} size={38} channel="instagram" />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyMedium">{f.name}</Txt>
                  <Txt v="small" color={t.textMuted}>{f.handle}</Txt>
                </View>
                <ChevronRight size={17} color={t.textFaint} strokeWidth={STROKE} />
              </Pressable>
            ))}
          </View>
          <View style={styles.explain}>
            <Info size={15} color={t.textMuted} strokeWidth={STROKE} />
            <Txt v="small" color={t.textMuted} style={{ flex: 1 }}>Instagram only allows starting a chat with people who follow you.</Txt>
          </View>
        </Step>
      )}

      <View style={[styles.explain, styles.footnote]}>
        <Globe size={15} color={t.textFaint} strokeWidth={STROKE} />
        <Txt v="small" color={t.textFaint} style={{ flex: 1 }}>Website chats start when a visitor messages you from your site.</Txt>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xxxl, width: '100%', maxWidth: 600, alignSelf: 'center', gap: space.lg },
  channels: { flexDirection: 'row', gap: space.sm },
  channelCard: {
    flex: 1, minWidth: 0, gap: 2, padding: space.md, borderRadius: radius.lg, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.border,
  },
  channelTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardOn: { borderColor: t.primary, backgroundColor: '#FBFCFF' },
  channelLogo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: t.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.primary },
  step: { gap: space.sm + 2 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepNum: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
  notice: { borderRadius: radius.lg, overflow: 'hidden' },
  card: { borderRadius: radius.lg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 11 },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
  fieldFocus: { backgroundColor: '#FBFCFF' },
  input: { flex: 1, minHeight: 50, color: t.text },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  explain: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 2 },
  footnote: { marginTop: space.sm, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  message: { minHeight: 120, textAlignVertical: 'top', padding: space.md, color: t.text },
})
