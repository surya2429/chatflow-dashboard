import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { ChevronLeft, ChevronRight, CircleAlert, CornerUpLeft, FileText, Send } from 'lucide-react-native'
import { api, errorMessage } from '@/lib/api'
import { font, radius, space, theme as t, type } from '@/lib/theme'
import type { Template } from '@/lib/types'
import { Badge, Button, EmptyState, Notice, SearchField, Sheet, Skeleton, STROKE, Txt } from '../ui'

type PressState = { pressed: boolean; hovered?: boolean }

/**
 * WhatsApp template picker. Outside the 24-hour customer-service window,
 * WhatsApp only allows pre-approved templates — this is how an agent reopens a
 * conversation (or starts a new one). Each {{n}} placeholder gets an input and
 * the preview renders exactly what the customer will receive; sending is
 * blocked until every variable is filled, as the server also enforces.
 */
export function TemplatePicker({ visible, onClose, onSend, contactName, sendLabel = 'Send template' }: {
  visible: boolean
  onClose: () => void
  onSend: (template: Template, variables: string[]) => Promise<void>
  contactName?: string
  sendLabel?: string
}) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Template | null>(null)
  const [vars, setVars] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (visible && !templates) api.templates().then(r => setTemplates(r.items)).catch(err => setError(errorMessage(err)))
  }, [visible, templates])

  const close = () => {
    setSelected(null)
    setError(null)
    onClose()
  }

  const pick = (tpl: Template) => {
    setSelected(tpl)
    // First variable is almost always the customer's name — prefill it.
    setVars(Array.from({ length: tpl.variableCount }, (_, i) => (i === 0 && contactName ? contactName.split(' ')[0]! : '')))
  }

  const preview = useMemo(() => selected?.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => vars[Number(n) - 1]?.trim() || `{{${n}}}`) ?? '', [selected, vars])
  const complete = !!selected && vars.every(v => v.trim())
  const q = query.trim().toLowerCase()
  const filtered = (templates ?? []).filter(x => !q || x.name.includes(q) || x.body.toLowerCase().includes(q))

  const send = async () => {
    if (!selected || !complete) return
    setSending(true)
    setError(null)
    try {
      await onSend(selected, vars.map(v => v.trim()))
      close()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={close}
      width={560}
      title={selected ? selected.name : 'WhatsApp templates'}
      subtitle={selected ? 'Fill in the variables — the preview is exactly what the customer receives' : 'Pre-approved messages you can send at any time'}
      footer={selected ? <Button title={sendLabel} icon={Send} size="lg" style={{ flex: 1 }} onPress={send} loading={sending} disabled={!complete} /> : undefined}
    >
      {error && <Notice tone="danger" icon={CircleAlert} text={error} />}
      {!selected ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search templates" style={{ marginHorizontal: space.xl, marginBottom: space.sm }} />
          {!templates && !error && (
            <View style={{ padding: space.xl, gap: space.lg }}>
              {[0, 1, 2].map(i => <View key={i} style={{ gap: 8 }}><Skeleton w="40%" h={14} /><Skeleton w="90%" h={12} /></View>)}
            </View>
          )}
          {templates && filtered.length === 0 && <EmptyState icon={FileText} title="No templates found" body="Try a different word." />}
          {filtered.map(tpl => (
            <Pressable key={tpl.id} onPress={() => pick(tpl)} accessibilityRole="button"
              style={(s) => [styles.tplRow, ((s as PressState).pressed || (s as PressState).hovered) && { backgroundColor: t.surfaceHover }]}>
              <View style={styles.tplIcon}><FileText size={17} color={t.primary} strokeWidth={STROKE} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.tplHead}>
                  <Txt v="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>{tpl.name}</Txt>
                  <Badge label={tpl.category.toLowerCase()} tone={tpl.category === 'MARKETING' ? 'amber' : 'blue'} />
                </View>
                <Txt v="small" color={t.textMuted} numberOfLines={2}>{tpl.body}</Txt>
              </View>
              <ChevronRight size={17} color={t.textFaint} strokeWidth={STROKE} />
            </Pressable>
          ))}
        </>
      ) : (
        <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
          <Pressable onPress={() => setSelected(null)} style={styles.back} accessibilityRole="button" hitSlop={8}>
            <ChevronLeft size={16} color={t.primary} strokeWidth={2.2} />
            <Txt v="smallMedium" color={t.primary} style={{ fontFamily: font.semibold }}>All templates</Txt>
          </Pressable>
          {vars.map((v, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Txt v="smallMedium" color={t.textSoft}>{`Variable {{${i + 1}}}`}{i === 0 && contactName ? ' · customer’s first name' : ''}</Txt>
              <TextInput
                value={v}
                onChangeText={(x) => setVars(prev => prev.map((p, j) => (j === i ? x : p)))}
                style={[type.body, styles.input, { borderColor: v.trim() ? t.border : t.warningBorder }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                placeholder={`Value for {{${i + 1}}}`}
                placeholderTextColor={t.textFaint}
                accessibilityLabel={`Template variable ${i + 1}`}
              />
            </View>
          ))}
          <Txt v="overline" color={t.textFaint} style={{ marginTop: space.sm }}>Preview</Txt>
          <View style={styles.previewWrap}>
            <View style={styles.preview}>
              {selected.header ? <Txt v="subheading">{selected.header}</Txt> : null}
              <Txt v="body">{preview}</Txt>
              {selected.footer ? <Txt v="caption" color={t.textMuted}>{selected.footer}</Txt> : null}
              {selected.buttons.map(b => (
                <View key={b} style={styles.previewButton}>
                  <CornerUpLeft size={13} color={t.primary} strokeWidth={2.2} />
                  <Txt v="smallMedium" color={t.primary} style={{ fontFamily: font.semibold }}>{b}</Txt>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.md },
  tplIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tplHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, height: 44, color: t.text, backgroundColor: t.surface },
  previewWrap: { padding: space.md, borderRadius: radius.lg, backgroundColor: t.chatBg },
  preview: {
    maxWidth: 360, padding: 12, paddingBottom: 4, gap: 5, borderRadius: 16, borderTopLeftRadius: 6, backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  previewButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, marginHorizontal: -12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
  },
})
