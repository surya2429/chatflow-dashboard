import { Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import type { PickedFile } from './api'
import type { AttachmentKind, Channel } from './types'

/**
 * Picking files to send. The server checks every type and size against the
 * channel (agent-api attachmentPolicy.ts); this only offers the sources that
 * make sense — Instagram DMs can't carry documents.
 */
export const CAN_SEND_DOCUMENTS: Record<Channel, boolean> = { whatsapp: true, instagram: false, webchat: true }

const DOCUMENT_TYPES = [
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export class PickerError extends Error {}

function fromAsset(a: ImagePicker.ImagePickerAsset): PickedFile {
  const video = a.type === 'video'
  const mime = a.mimeType ?? (video ? 'video/mp4' : 'image/jpeg')
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] ?? 'bin'
  return {
    uri: a.uri,
    name: a.fileName ?? `${video ? 'video' : 'photo'}-${Date.now()}.${ext}`,
    mime,
    size: a.fileSize,
    width: a.width || undefined,
    height: a.height || undefined,
  }
}

export async function pickMedia(): Promise<PickedFile | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) throw new PickerError('Allow photo access in Settings to send pictures')
  }
  // quality < 1 makes iOS export HEIC photos as JPEG, which every channel accepts.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 })
  return r.canceled || !r.assets[0] ? null : fromAsset(r.assets[0])
}

export const cameraAvailable = Platform.OS !== 'web'

export async function takePhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) throw new PickerError('Allow camera access in Settings to take a photo')
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
  return r.canceled || !r.assets[0] ? null : fromAsset(r.assets[0])
}

export async function pickDocument(): Promise<PickedFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, copyToCacheDirectory: true, multiple: false })
  if (r.canceled || !r.assets[0]) return null
  const a = r.assets[0]
  return { uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream', size: a.size ?? undefined }
}

export function kindOfMime(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/** File-type badge: short label and colour for document icons. */
export function docStyle(name: string, mime: string): { label: string; color: string } {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (mime === 'application/pdf' || ext === 'pdf') return { label: 'PDF', color: '#E5484D' }
  if (/word/.test(mime) || ['doc', 'docx'].includes(ext)) return { label: 'DOC', color: '#2F6FEB' }
  if (/sheet|excel|csv/.test(mime) || ['xls', 'xlsx', 'csv'].includes(ext)) return { label: ext === 'csv' ? 'CSV' : 'XLS', color: '#1F9D55' }
  if (/presentation|powerpoint/.test(mime) || ['ppt', 'pptx'].includes(ext)) return { label: 'PPT', color: '#E8590C' }
  return { label: (ext || 'FILE').slice(0, 4).toUpperCase(), color: '#71717A' }
}
