import { forbidden } from '../http/errors.js'

/**
 * Server-side authorization. The dashboard's roles only ever decided which
 * nav items were drawn; nothing stopped a client calling an "admin" code path
 * directly. Every mutating route here calls `authorize()` before touching the
 * database, so hiding a button in the app is cosmetic and never the control.
 *
 * Two layers:
 *   1. Role → capability (what kind of thing may this role ever do).
 *   2. Ownership rules on a specific conversation (an agent may act on chats
 *      that are theirs or unowned; supervisors and admins on any).
 */
export type Role = 'admin' | 'supervisor' | 'agent'

export interface Actor {
  id: string
  role: Role
  name: string
}

export type Capability =
  | 'conversation.read'
  | 'conversation.reply'
  | 'conversation.note'
  | 'conversation.takeover'
  | 'conversation.transfer'
  | 'conversation.resolve'
  | 'conversation.return_to_bot'
  | 'conversation.snooze'
  | 'conversation.star'
  | 'conversation.archive'
  | 'conversation.label'
  | 'conversation.start'          // open a new thread (WhatsApp template / IG follower)
  | 'conversation.override_owner' // act on a chat assigned to someone else
  | 'contact.update'
  | 'call.place'
  | 'team.read'
  | 'team.presence.read'
  | 'analytics.team'              // view another agent's analytics
  | 'user.manage'

const AGENT: Capability[] = [
  'conversation.read', 'conversation.reply', 'conversation.note', 'conversation.takeover',
  'conversation.transfer', 'conversation.resolve', 'conversation.return_to_bot', 'conversation.snooze',
  'conversation.star', 'conversation.archive', 'conversation.label', 'conversation.start',
  'contact.update', 'call.place', 'team.read',
]
const SUPERVISOR: Capability[] = [...AGENT, 'conversation.override_owner', 'team.presence.read', 'analytics.team']
const ADMIN: Capability[] = [...SUPERVISOR, 'user.manage']

const CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  agent: new Set(AGENT),
  supervisor: new Set(SUPERVISOR),
  admin: new Set(ADMIN),
}

export function can(actor: Pick<Actor, 'role'>, capability: Capability): boolean {
  return CAPABILITIES[actor.role]?.has(capability) ?? false
}

export function authorize(actor: Pick<Actor, 'role'>, capability: Capability): void {
  if (!can(actor, capability)) throw forbidden('forbidden', `Role '${actor.role}' may not ${capability}`)
}

/** The parts of a conversation ownership rules look at. */
export interface OwnedConversation {
  agent_id: string | null
  status: 'bot' | 'agent' | 'resolved'
}

/**
 * Actions on a conversation that another agent currently owns. An agent may
 * act on their own chats and on unowned ones (bot-handled, resolved,
 * unassigned). Taking a chat away from a colleague requires a supervisor —
 * or the colleague transferring it.
 */
export function authorizeOnConversation(actor: Actor, capability: Capability, conv: OwnedConversation): void {
  authorize(actor, capability)
  const ownedBySomeoneElse = conv.agent_id !== null && conv.agent_id !== actor.id && conv.status === 'agent'
  if (ownedBySomeoneElse && !can(actor, 'conversation.override_owner')) {
    throw forbidden('assigned_to_another_agent', 'This conversation is assigned to another agent')
  }
}

/** The capability list the app uses to decide what to render. Advisory only. */
export function capabilitiesOf(role: Role): Capability[] {
  return [...CAPABILITIES[role]]
}
