import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Redirect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ArrowRight, BellRing, CheckCheck, CircleAlert, Eye, EyeOff, LockKeyhole, Mail, MessagesSquare, PhoneCall, ShieldCheck, Zap, type LucideIcon,
} from 'lucide-react-native'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { font, radius, shadow, space, theme as t, type, useLayout } from '@/lib/theme'
import { BrandGlyph, Button, Notice, Txt } from '@/components/ui'

const POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MessagesSquare, title: 'One inbox', text: 'WhatsApp, Instagram and your website chat together' },
  { icon: Zap, title: 'Real time', text: 'New messages appear instantly — no refreshing' },
  { icon: PhoneCall, title: 'Calls built in', text: 'Voice and video with website visitors' },
]

/** Sign-in. Desktop: brand panel + form side by side. Phone: compact brand header over the form. */
export default function Login() {
  const { state, signIn } = useAuth()
  const { isWide } = useLayout()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'signedIn') return <Redirect href="/" />

  const submit = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const form = (
    <View style={[styles.form, isWide && { paddingHorizontal: 0 }]}>
      {!isWide && <Logo dark={false} />}
      <Txt v="largeTitle" style={{ marginTop: isWide ? 0 : space.xxl }}>Sign in</Txt>
      <Txt v="body" color={t.textMuted} style={{ marginTop: 4 }}>Welcome back — pick up your conversations where you left off.</Txt>

      {error && <View style={styles.error}><Notice tone="danger" icon={CircleAlert} text={error} /></View>}

      <Txt v="smallMedium" color={t.textSoft} style={styles.label}>Work email</Txt>
      <View style={[styles.field, focused === 'email' && styles.fieldFocus]}>
        <Mail size={17} color={focused === 'email' ? t.primary : t.textFaint} strokeWidth={1.9} />
        <TextInput
          style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
          placeholder="you@company.com"
          placeholderTextColor={t.textFaint}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          accessibilityLabel="Work email"
        />
      </View>

      <Txt v="smallMedium" color={t.textSoft} style={styles.label}>Password</Txt>
      <View style={[styles.field, focused === 'password' && styles.fieldFocus]}>
        <LockKeyhole size={17} color={focused === 'password' ? t.primary : t.textFaint} strokeWidth={1.9} />
        <TextInput
          style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          placeholder="Your password"
          placeholderTextColor={t.textFaint}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel="Password"
        />
        <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8} accessibilityRole="button" style={styles.eye}
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
          {showPassword ? <EyeOff size={18} color={t.textMuted} strokeWidth={1.9} /> : <Eye size={18} color={t.textMuted} strokeWidth={1.9} />}
        </Pressable>
      </View>

      <Button title="Sign in" iconRight={ArrowRight} size="lg" onPress={submit} loading={busy} style={{ marginTop: space.xl }} />
      <View style={styles.secure}>
        <ShieldCheck size={14} color={t.textFaint} strokeWidth={1.9} />
        <Txt v="small" color={t.textFaint}>Encrypted session · you stay signed in until you sign out</Txt>
      </View>
    </View>
  )

  if (isWide) {
    return (
      <View style={styles.split}>
        <LinearGradient colors={['#0B1733', '#0A1224']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandPane}>
          <View style={styles.glow} />
          <Logo dark />
          <View style={{ maxWidth: 480 }}>
            <Txt style={styles.headline}>Every customer conversation, <Txt style={[styles.headline, { color: '#6AA5FF' }]}>in one place.</Txt></Txt>
            <View style={{ gap: space.lg, marginTop: space.xxl }}>
              {POINTS.map(p => (
                <View key={p.title} style={styles.point}>
                  <View style={styles.pointIcon}><p.icon size={17} color="#8CB8FF" strokeWidth={1.9} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt v="subheading" color="#FFFFFF">{p.title}</Txt>
                    <Txt v="small" color="#9FB0CF">{p.text}</Txt>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <PreviewCard />
        </LinearGradient>
        <ScrollView style={{ flex: 1, backgroundColor: t.surface }} contentContainerStyle={styles.formPane} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 400 }}>{form}</View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <SafeAreaView edges={['top']} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: space.xl }} keyboardShouldPersistTaps="handled" bounces={false}>
          {form}
          <View style={styles.channels}>
            {(['whatsapp', 'instagram', 'webchat'] as const).map(ch => (
              <View key={ch} style={[styles.channelDot, { backgroundColor: t.channel[ch] }]}><BrandGlyph channel={ch} size={14} /></View>
            ))}
            <Txt v="caption" color={t.textMuted}>WhatsApp · Instagram · Website chat</Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Logo({ dark }: { dark: boolean }) {
  return (
    <View style={styles.brand}>
      <LinearGradient colors={['#2C7BFF', '#0055D6']} style={styles.logo}><MessagesSquare size={18} color="#FFFFFF" strokeWidth={2.2} /></LinearGradient>
      <View>
        <Txt v="subheading" color={dark ? '#FFFFFF' : t.text} style={{ fontFamily: font.bold }}>ChatFlow</Txt>
        <Txt v="caption" color={dark ? '#8B9CC0' : t.textMuted}>Agent workspace</Txt>
      </View>
    </View>
  )
}

/** A small, static product glimpse — shows what the app is before anyone signs in. */
function PreviewCard() {
  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        <View style={[styles.channelDot, { backgroundColor: t.channel.whatsapp, width: 30, height: 30, borderRadius: 15 }]}><BrandGlyph channel="whatsapp" size={16} /></View>
        <View style={{ flex: 1 }}>
          <Txt v="smallMedium" color="#FFFFFF" style={{ fontFamily: font.semibold }}>Priya Sharma</Txt>
          <Txt v="caption" color="#8B9CC0">+91 98765 43210 · Acme Support</Txt>
        </View>
        <View style={styles.livePill}><BellRing size={11} color="#34D399" strokeWidth={2.2} /><Txt v="caption" color="#34D399" style={{ fontFamily: font.semibold }}>Live</Txt></View>
      </View>
      <View style={[styles.bubble, styles.bubbleIn]}><Txt v="small" color="#E5ECF8">Hi! Can I change my delivery address?</Txt></View>
      <View style={[styles.bubble, styles.bubbleOut]}>
        <Txt v="small" color="#FFFFFF">Of course — share the new address and I’ll update it right away.</Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 }}><CheckCheck size={13} color="#BFDBFE" strokeWidth={2.2} /></View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row', backgroundColor: t.surface },
  brandPane: { width: '46%', maxWidth: 640, padding: 48, justifyContent: 'space-between', overflow: 'hidden' },
  glow: { position: 'absolute', width: 520, height: 520, borderRadius: 260, right: -200, top: -160, backgroundColor: 'rgba(0,102,255,0.18)' },
  formPane: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  form: { paddingHorizontal: space.xl, paddingBottom: space.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headline: { color: '#FFFFFF', fontFamily: font.extrabold, fontSize: 34, lineHeight: 41, letterSpacing: -1 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: {
    width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(77,148,255,0.12)', borderWidth: 1, borderColor: 'rgba(77,148,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  preview: {
    maxWidth: 420, padding: space.lg, gap: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', ...shadow.floating,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(16,185,129,0.12)' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleIn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.09)', borderTopLeftRadius: 6 },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: t.primary, borderTopRightRadius: 6 },
  error: { marginTop: space.lg, borderRadius: radius.md, overflow: 'hidden' },
  label: { marginTop: space.lg, marginBottom: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: t.border,
    borderRadius: radius.md, paddingLeft: space.md, minHeight: 48, backgroundColor: t.surface,
  },
  fieldFocus: { borderColor: t.primary, boxShadow: '0 0 0 3px rgba(0,102,255,0.12)' },
  input: { ...type.body, flex: 1, color: t.text, minHeight: 46 },
  eye: { height: 46, paddingHorizontal: space.md, justifyContent: 'center' },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.lg },
  channels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingBottom: space.xxl },
  channelDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})
