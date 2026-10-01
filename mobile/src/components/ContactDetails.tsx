import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import {
  AtSign, Building, Check, CircleCheck, Clock, Flag, FingerprintPattern, Globe, Languages, Link, Mail, MapPin, MessageSquareText,
  Monitor, Pencil, Phone, Plus, Repeat, Sparkles, SlidersHorizontal, UserRound, X, type LucideIcon,
} from 'lucide-react-native'
import { api, errorMessage } from '@/lib/api'
import { clockTime, formatPhone, listTime } from '@/lib/format'
import { font, radius, space, theme as t, type } from '@/lib/theme'
import type { ContactPanel } from '@/lib/types'
import { Avatar, Badge, CHANNEL_LABEL, haptic, IconButton, STROKE, StatusBadge, Toast, Txt } from './ui'

const PROFILE_FIELDS: { key: string; label: string; icon: LucideIcon; keyboard?: 'email-address' | 'phone-pad' }[] = [
  { key: 'email', label: 'Email', icon: Mail, keyboard: 'email-address' },
  { key: 'phone', label: 'Phone', icon: Phone, keyboard: 'phone-pad' },
  { key: 'company', label: 'Company', icon: Building },
  { key: 'city', label: 'City', icon: MapPin },
  { key: 'country', label: 'Country', icon: Flag },
  { key: 'language', label: 'Language', icon: Languages },
]

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt v="overline" color={t.textFaint} style={{ flex: 1 }}>{title}</Txt>
        {right}
      </View>
      {children}
    </View>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Icon size={15} color={t.textMuted} strokeWidth={STROKE} />
      <Txt v="small" color={t.textMuted} style={{ width: 92 }}>{label}</Txt>
      <Txt v="smallMedium" selectable numberOfLines={2} style={[{ flex: 1, color: t.textStrong }, mono && { fontFamily: font.medium, letterSpacing: 0.2 }]}>{value}</Txt>
    </View>
  )
}

/** Inline-editable field: tap to edit, Enter/blur saves, Esc/✕ cancels. */
function EditableRow({ icon: Icon, label, value, onSave, keyboard }: {
  icon: LucideIcon; label: string; value: string; onSave: (v: string) => Promise<void>; keyboard?: 'email-address' | 'phone-pad'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const commit = async () => {
    if (draft.trim() === value) { setEditing(false); return }
    setSaving(true)
    try { await onSave(draft.trim()); setEditing(false) } catch { /* caller toasts */ } finally { setSaving(false) }
  }
  if (editing) {
    return (
      <View style={[styles.row, styles.editing]}>
        <Icon size={15} color={t.primary} strokeWidth={STROKE} />
        <TextInput
          value={draft} onChangeText={setDraft} autoFocus onSubmitEditing={commit} placeholder={label} placeholderTextColor={t.textFaint}
          keyboardType={keyboard} autoCapitalize={keyboard ? 'none' : 'sentences'}
          style={[type.smallMedium, { flex: 1, color: t.text, paddingVertical: 4 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          accessibilityLabel={label}
        />
        {saving ? <ActivityIndicator size="small" color={t.primary} /> : (
          <>
            <Pressable onPress={() => { setDraft(value); setEditing(false) }} hitSlop={6} accessibilityLabel="Cancel"><X size={16} color={t.textMuted} /></Pressable>
            <Pressable onPress={commit} hitSlop={6} accessibilityLabel="Save"><Check size={16} color={t.primary} strokeWidth={2.4} /></Pressable>
          </>
        )}
      </View>
    )
  }
  return (
    <Pressable onPress={() => { haptic(); setDraft(value); setEditing(true) }} accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'empty'}. Edit`}
      style={(s) => [styles.row, ((s as { hovered?: boolean }).hovered || s.pressed) && { backgroundColor: t.surfaceHover }]}>
      <Icon size={15} color={t.textMuted} strokeWidth={STROKE} />
      <Txt v="small" color={t.textMuted} style={{ width: 92 }}>{label}</Txt>
      <Txt v="smallMedium" numberOfLines={1} style={{ flex: 1, color: value ? t.textStrong : t.textFaint }}>{value || 'Add'}</Txt>
      <Pencil size={13} color={t.textFaint} strokeWidth={STROKE} />
    </Pressable>
  )
}

/**
 * Everything about the customer: identity (per channel rule), editable
 * profile, the website visit, what the bot captured, custom fields and their
 * other conversations.
 */
export function ContactDetails({ contactId, onClose, currentConversationId }: { contactId: string; onClose?: () => void; currentConversationId?: string }) {
  const [panel, setPanel] = useState<ContactPanel | null>(null)
  const [toast, setToast] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const load = useCallback(() => api.contact(contactId).then(setPanel).catch(err => setToast({ text: errorMessage(err), tone: 'danger' })), [contactId])
  useEffect(() => { void load() }, [load])

  const save = async (patch: Parameters<typeof api.updateContact>[1]) => {
    try {
      const contact = await api.updateContact(contactId, patch)
      setPanel(p => (p ? { ...p, contact } : p))
      setToast({ text: 'Saved', tone: 'success' })
    } catch (err) {
      setToast({ text: errorMessage(err), tone: 'danger' })
      throw err
    }
  }

  if (!panel) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.primary} />
        <Toast text={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      </View>
    )
  }

  const c = panel.contact
  const email = typeof c.profile.email === 'string' && c.profile.email ? c.profile.email : null
  const identity: { icon: LucideIcon; label: string; value: string }[] =
    c.channel === 'whatsapp' ? [{ icon: Phone, label: 'WhatsApp', value: formatPhone(c.phone) }]
      : c.channel === 'instagram' ? [{ icon: AtSign, label: 'Instagram', value: c.handle ?? '' }]
        : [
            ...(email ? [{ icon: Mail, label: 'Email', value: email }] : []),
            { icon: FingerprintPattern, label: 'Visitor ID', value: c.visitorId ?? '' },
          ]
  const visit = c.channel === 'webchat' && c.visitor ? ([
    [Globe, 'Page', c.visitor.page], [Monitor, 'Browser', [c.visitor.browser, c.visitor.os].filter(Boolean).join(' · ')],
    [MapPin, 'Location', c.visitor.location], [Link, 'Came from', c.visitor.referrer], [Repeat, 'Visits', c.visitor.visits?.toString()],
  ] as [LucideIcon, string, string | undefined][]).filter(([, , v]) => v) : []
  const others = panel.conversations.filter(pc => pc.id !== currentConversationId)

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      {onClose && (
        <View style={styles.paneHead}>
          <Txt v="subheading" style={{ flex: 1 }}>Details</Txt>
          <IconButton icon={X} label="Close details" onPress={onClose} size={18} box={32} />
        </View>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Avatar label={c.avatar ?? c.name.slice(0, 2)} seed={c.id} size={64} channel={c.channel} />
          <Txt v="title" style={{ marginTop: space.md, textAlign: 'center' }} numberOfLines={2}>{c.name}</Txt>
          <View style={styles.heroMeta}>
            <Badge label={CHANNEL_LABEL[c.channel]} tone={c.channel === 'instagram' ? 'red' : c.channel === 'whatsapp' ? 'green' : 'purple'} />
            {c.channel === 'instagram' && <Badge label={c.isFollower ? 'Follows you' : 'Not following'} tone={c.isFollower ? 'blue' : 'gray'} />}
          </View>
          <Txt v="caption" color={t.textFaint} style={{ marginTop: 6 }}>Customer since {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Txt>
        </View>

        <Section title="Identity">
          {identity.map(r => <Row key={r.label} icon={r.icon} label={r.label} value={r.value || '—'} mono />)}
        </Section>

        <Section title="Profile">
          <EditableRow icon={UserRound} label="Name" value={c.name} onSave={(v) => save({ name: v })} />
          {PROFILE_FIELDS.filter(f => !(f.key === 'phone' && c.channel === 'whatsapp')).map(f => (
            <EditableRow key={f.key} icon={f.icon} label={f.label} keyboard={f.keyboard}
              value={String(c.profile[f.key] ?? '')} onSave={(v) => save({ profile: { [f.key]: v || null } })} />
          ))}
        </Section>

        {visit.length > 0 && (
          <Section title="Website visit">
            {visit.map(([icon, label, v]) => <Row key={label} icon={icon} label={label} value={v!} />)}
          </Section>
        )}

        <Section title="Captured by the bot">
          {panel.capturedAnswers.length === 0 ? (
            <View style={styles.row}><Sparkles size={15} color={t.textFaint} strokeWidth={STROKE} /><Txt v="small" color={t.textFaint}>Nothing captured yet</Txt></View>
          ) : panel.capturedAnswers.map(a => (
            <View key={a.id} style={styles.answer}>
              <CircleCheck size={15} color={t.primary} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Txt v="caption" color={t.textMuted}>{a.label}</Txt>
                <Txt v="smallMedium" selectable>{a.value}</Txt>
              </View>
              <Txt v="caption" color={t.textFaint}>{clockTime(a.time)}</Txt>
            </View>
          ))}
        </Section>

        <Section title="Custom fields">
          {Object.entries(c.customFields).map(([k, v]) => (
            <EditableRow key={k} icon={SlidersHorizontal} label={k} value={String(v)} onSave={(val) => save({ customFields: { [k]: val || null } })} />
          ))}
          <View style={styles.addRow}>
            <TextInput value={newKey} onChangeText={setNewKey} placeholder="Field" placeholderTextColor={t.textFaint}
              style={[type.small, styles.addInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} autoCapitalize="none" accessibilityLabel="New field name" />
            <TextInput value={newValue} onChangeText={setNewValue} placeholder="Value" placeholderTextColor={t.textFaint}
              style={[type.small, styles.addInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} accessibilityLabel="New field value" />
            <IconButton icon={Plus} label="Add field" variant="primary" box={36} size={18} disabled={!newKey.trim() || !newValue.trim()}
              onPress={() => { void save({ customFields: { [newKey.trim()]: newValue.trim() } }).then(() => { setNewKey(''); setNewValue('') }).catch(() => {}) }} />
          </View>
        </Section>

        <Section title={`Conversations · ${panel.conversations.length}`}>
          {others.length === 0 && <View style={styles.row}><MessageSquareText size={15} color={t.textFaint} strokeWidth={STROKE} /><Txt v="small" color={t.textFaint}>No other conversations</Txt></View>}
          {others.map(pc => (
            <Pressable key={pc.id} onPress={() => { haptic(); router.push({ pathname: '/conversation/[id]', params: { id: pc.id } }) }} accessibilityRole="button"
              style={(s) => [styles.convo, ((s as { hovered?: boolean }).hovered || s.pressed) && { backgroundColor: t.surfaceHover }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Txt v="smallMedium" numberOfLines={1}>{pc.lastMessage || '—'}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <StatusBadge status={pc.status} />
                  <Clock size={11} color={t.textFaint} />
                  <Txt v="caption" color={t.textMuted}>{listTime(pc.timestamp)}{pc.botName ? ` · ${pc.botName}` : ''}</Txt>
                </View>
              </View>
            </Pressable>
          ))}
        </Section>
      </ScrollView>
      <Toast text={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface },
  paneHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, paddingRight: space.sm, height: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  hero: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.lg },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  section: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.sm, paddingVertical: 9, borderRadius: radius.sm, minHeight: 38 },
  editing: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.primary },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.sm, paddingVertical: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, paddingTop: 6 },
  addInput: { flex: 1, height: 36, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: t.surfaceAlt, color: t.text },
  convo: { paddingHorizontal: space.sm, paddingVertical: 9, borderRadius: radius.sm },
})
