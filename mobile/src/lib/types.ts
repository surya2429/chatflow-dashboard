/** Mirrors agent-api's DTOs (src/db/repositories/*.ts there). */
export type Channel = 'whatsapp' | 'instagram' | 'webchat'
export type ConversationStatus = 'bot' | 'agent' | 'resolved'
export type MessageType = 'incoming' | 'outgoing' | 'note' | 'event' | 'answer' | 'template'
export type Role = 'admin' | 'supervisor' | 'agent'
export type Presence = 'online' | 'away' | 'offline'

export interface User {
  id: string
  email?: string
  name: string
  initials: string
  color: string
  role: Role
  presence: Presence
  presenceUpdatedAt: string
  isActive: boolean
}

export interface Conversation {
  id: string
  contactId: string
  name: string
  avatar: string
  channel: Channel
  status: ConversationStatus
  agentId: string | null
  agentName: string | null
  source: string
  labels: string[]
  lastMessage: string
  unread: number
  starred: boolean
  archived: boolean
  snoozed: string | null
  timestamp: string
  version: number
  waitingSince: string | null
  botId: string | null
  botName: string | null
  botColor: string | null
  /** Who the customer is, per channel: phone / @handle / visitor name-email-or-id. Computed server-side. */
  identity: ContactIdentity
  phone?: string
  handle?: string
  visitorId?: string
  visitor?: { page?: string; browser?: string; os?: string; location?: string; referrer?: string; visits?: number; firstSeen?: string }
  whatsappWindow?: { open: boolean; expiresAt: string | null }
}

export interface ContactIdentity {
  kind: 'phone' | 'instagram' | 'visitor'
  primary: string
  secondary: string | null
  known?: boolean
}

export interface Bot {
  id: string
  name: string
  channel: Channel
  /** What customers reach it on: the WhatsApp number, @handle, or website domain. */
  identity: string
  description: string
  status: 'active' | 'paused'
  color: string
  stats: { open: number; unassigned: number; waiting: number; mine: number; unread: number; resolvedToday: number }
  agents: { id: string; name: string; initials: string; color: string; presence: Presence }[]
}

export interface TemplateSnapshot {
  name: string
  category?: string
  header?: string | null
  body?: string
  footer?: string | null
  buttons?: string[]
  variables?: string[]
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'document'

/** A file on a message. `url` is a signed path relative to the API origin (valid about a day). */
export interface Attachment {
  id: string
  kind: AttachmentKind
  name: string
  mime: string
  size: number
  width?: number
  height?: number
  url: string
}

export interface Message {
  id: string
  conversationId: string
  type: MessageType
  text: string
  time: string
  sender: string | null
  agentName?: string
  template?: TemplateSnapshot
  questionType?: string
  label?: string
  value?: string
  event?: string
  delivery?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  clientMsgId?: string
  attachment?: Attachment
  /** Client-only: optimistic message not yet acknowledged by the server. */
  local?: 'sending' | 'failed'
}

export interface Template {
  id: string
  name: string
  language: string
  category: string
  status: string
  headerType: string
  header: string | null
  body: string
  footer: string | null
  buttons: string[]
  variableCount: number
}

export interface Contact {
  id: string
  channel: Channel
  name: string
  avatar: string | null
  phone?: string
  handle?: string
  visitorId?: string
  isFollower?: boolean
  profile: Record<string, string>
  customFields: Record<string, string | number | boolean>
  visitor?: Conversation['visitor']
  createdAt: string
}

export interface ContactPanel {
  contact: Contact
  capturedAnswers: Message[]
  conversations: { id: string; status: ConversationStatus; lastMessage: string; timestamp: string; agentName: string | null; source: string; botName: string | null }[]
}

export interface Session {
  user: User
  capabilities: string[]
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
}

export interface CallInfo {
  callId: string
  conversationId: string
  direction: 'inbound' | 'outbound'
  video: boolean
  agentId: string | null
  contactName: string
  endReason?: string | null
}

export type LiveEvent =
  | { kind: 'conversation.updated'; conversation: Conversation }
  | { kind: 'message.created'; conversation: Conversation; message: Message }
  | { kind: 'message.updated'; conversationId: string; message: Message }
  | { kind: 'presence.updated'; user: { id: string; name: string; presence: Presence } }
  | { kind: 'call.ringing'; call: CallInfo }
  | { kind: 'call.answered'; call: CallInfo }
  | { kind: 'call.ended'; call: CallInfo }
