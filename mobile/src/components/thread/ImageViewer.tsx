import { Image, Linking, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExternalLink, X } from 'lucide-react-native'
import { fileUrl } from '@/lib/api'
import { formatBytes } from '@/lib/attachments'
import type { Attachment } from '@/lib/types'
import { Txt } from '../ui'

/** Full-screen photo, with its name and a way to open the original. Tap anywhere to close. */
export function ImageViewer({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  if (!attachment) return null
  const url = fileUrl(attachment.url)
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
        <Image source={{ uri: url }} style={styles.image} resizeMode="contain" accessibilityLabel={attachment.name} />
        <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={styles.btn}>
            <X size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="smallMedium" color="#FFFFFF" numberOfLines={1}>{attachment.name}</Txt>
            <Txt v="caption" color="rgba(255,255,255,0.65)">{formatBytes(attachment.size)}{attachment.width ? ` · ${attachment.width}×${attachment.height}` : ''}</Txt>
          </View>
          <Pressable onPress={() => { void Linking.openURL(url) }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open original" style={styles.btn}>
            <ExternalLink size={18} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  image: { width: '100%', height: '80%' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10 },
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
})
