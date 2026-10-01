import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Check, Globe, Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff, Volume2, X, type LucideIcon,
} from 'lucide-react-native'
import { useCalls, endText } from '@/calls/CallManager'
import { RTCView, streamProps } from '@/calls/webrtc'
import { nativeCallUiAvailable } from '@/calls/callkeep'
import { duration } from '@/lib/format'
import { font } from '@/lib/theme'
import { Avatar, Txt } from './ui'

/**
 * Full-screen call UI, over whatever screen is open. When the phone is locked
 * or the app is backgrounded, the OS call screen (CallKit / ConnectionService)
 * is what the agent sees; this takes over once the app is in front.
 */
function Control({ icon: Icon, label, onPress, active, tone, big }: {
  icon: LucideIcon; label: string; onPress: () => void; active?: boolean; tone?: 'danger' | 'success'; big?: boolean
}) {
  const size = big ? 72 : 60
  const bg = tone === 'danger' ? '#EF4444' : tone === 'success' ? '#10B981' : active ? '#FFFFFF' : 'rgba(255,255,255,0.14)'
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        aria-selected={active}
        style={({ pressed }) => [{
          width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg,
          opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
        }, !tone && !active && styles.glass]}
      >
        <Icon size={big ? 30 : 24} color={active && !tone ? '#0A1224' : '#FFFFFF'} strokeWidth={2} />
      </Pressable>
      <Txt v="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 11 }}>{label}</Txt>
    </View>
  )
}

export function CallScreen() {
  const { call, answer, decline, hangup, toggleMute, toggleCamera, toggleSpeaker, flipCamera, dismiss } = useCalls()
  const insets = useSafeAreaInsets()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (call?.status !== 'connected') return undefined
    const h = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(h)
  }, [call?.status])

  if (!call) return null
  const showVideo = call.video && !!call.remoteStream && call.status === 'connected'
  const statusText =
    call.status === 'incoming' ? `Incoming ${call.video ? 'video' : 'voice'} call`
      : call.status === 'ringing' ? 'Ringing…'
        : call.status === 'connecting' ? 'Connecting…'
          : call.status === 'connected' ? duration(now - (call.connectedAt ?? now))
            : endText(call.endReason)

  return (
    <Modal visible animationType="fade" onRequestClose={call.status === 'ended' ? dismiss : () => {}} statusBarTranslucent>
      <LinearGradient colors={['#0B1733', '#0A1224', '#05080F']} style={styles.root}>
        {/* Remote media: full-bleed video, or an invisible element that still plays audio (web). */}
        {call.remoteStream && (
          <RTCView {...streamProps(call.remoteStream)} objectFit="cover"
            style={showVideo ? StyleSheet.absoluteFill : styles.hidden} />
        )}
        {call.video && call.localStream && !call.cameraOff && call.status !== 'ended' && (
          <RTCView {...streamProps(call.localStream)} mirror objectFit="cover" zOrder={1}
            style={[styles.pip, { top: insets.top + 16 }]} />
        )}

        <View style={[styles.header, { paddingTop: insets.top + 56 }]}>
          <View style={styles.source}>
            <Globe size={13} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            <Txt v="caption" color="rgba(255,255,255,0.8)" style={{ fontFamily: font.semibold }}>Website chat</Txt>
          </View>
          {!showVideo && (
            <View style={[styles.ring, call.status === 'incoming' || call.status === 'ringing' ? styles.ringOn : null]}>
              <Avatar label={call.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2)} seed={call.conversationId} size={104} />
            </View>
          )}
          <Txt style={styles.name} numberOfLines={1}>{call.name}</Txt>
          <Txt v="body" color="rgba(255,255,255,0.7)" accessibilityLiveRegion="polite" style={{ fontVariant: ['tabular-nums'] }}>{statusText}</Txt>
        </View>

        <View style={[styles.controls, { paddingBottom: insets.bottom + 36 }]}>
          {call.status === 'incoming' ? (
            <View style={styles.row}>
              <Control icon={X} label="Decline" tone="danger" big onPress={() => decline()} />
              <Control icon={call.video ? Video : Phone} label="Answer" tone="success" big onPress={() => { void answer() }} />
            </View>
          ) : call.status === 'ended' ? (
            <View style={styles.row}><Control icon={Check} label="Close" onPress={dismiss} /></View>
          ) : (
            <>
              <View style={styles.panel}>
                <Control icon={call.muted ? MicOff : Mic} label={call.muted ? 'Unmute' : 'Mute'} active={call.muted} onPress={toggleMute} />
                {call.video && <Control icon={call.cameraOff ? VideoOff : Video} label={call.cameraOff ? 'Camera on' : 'Camera off'} active={call.cameraOff} onPress={toggleCamera} />}
                {call.video && nativeCallUiAvailable && <Control icon={SwitchCamera} label="Flip" onPress={flipCamera} />}
                {nativeCallUiAvailable && <Control icon={Volume2} label="Speaker" active={call.speaker} onPress={toggleSpeaker} />}
              </View>
              <View style={styles.row}><Control icon={PhoneOff} label="End call" tone="danger" big onPress={hangup} /></View>
            </>
          )}
        </View>
      </LinearGradient>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  pip: { position: 'absolute', right: 16, width: 110, height: 160, borderRadius: 16, overflow: 'hidden', zIndex: 2 },
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  source: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 18,
  },
  ring: { padding: 6, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: 'rgba(96,165,250,0.45)' },
  name: { color: '#FFFFFF', fontSize: 27, lineHeight: 32, fontFamily: font.bold, letterSpacing: -0.6, marginTop: 14 },
  controls: { gap: 28, alignItems: 'center' },
  panel: {
    flexDirection: 'row', justifyContent: 'center', gap: 22, paddingHorizontal: 22, paddingVertical: 16, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 64, paddingHorizontal: 16 },
  control: { alignItems: 'center', gap: 8, minWidth: 64 },
  glass: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
})
