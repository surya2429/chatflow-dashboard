import { z } from 'zod'

/**
 * Deliberately permissive schemas — we only assert the shape of fields we
 * actually read. Meta adds new optional fields to this payload regularly;
 * a strict schema would break ingestion every time they ship a field we
 * don't care about yet.
 */

const ContactSchema = z.object({
  wa_id: z.string(),
  profile: z.object({ name: z.string().optional() }).optional(),
})

const StatusErrorSchema = z.object({
  code: z.number(),
  title: z.string(),
  message: z.string().optional(),
})

const StatusSchema = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string(),
  recipient_id: z.string(),
  biz_opaque_callback_data: z.string().optional(),
  errors: z.array(StatusErrorSchema).optional(),
  pricing: z.object({ category: z.string().optional() }).optional(),
})

const MessageContextSchema = z.object({
  id: z.string().optional(),
})

const MessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
  context: MessageContextSchema.optional(),
  text: z.object({ body: z.string() }).optional(),
  button: z.object({ text: z.string(), payload: z.string() }).optional(),
  interactive: z.record(z.string(), z.unknown()).optional(),
  // present on the first message of a chat that started from a Click-to-WhatsApp ad
  referral: z.record(z.string(), z.unknown()).optional(),
})

// Marketing Messages API: someone opened a link in a marketing message. No recipient and no message id are given.
const UserActionSchema = z.object({
  action_type: z.string(),
  timestamp: z.union([z.string(), z.number()]),
  marketing_messages_link_click_data: z
    .object({
      click_component: z.string().optional(),
      product_id: z.string().optional(),
      click_id: z.string().optional(),
      tracking_token: z.string().optional(),
    })
    .optional(),
})

const ValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({ phone_number_id: z.string() }),
  contacts: z.array(ContactSchema).optional(),
  messages: z.array(MessageSchema).optional(),
  statuses: z.array(StatusSchema).optional(),
  user_actions: z.array(UserActionSchema).optional(),
})

const ChangeSchema = z.object({
  field: z.string(),
  value: ValueSchema,
})

const EntrySchema = z.object({
  id: z.string(),
  changes: z.array(ChangeSchema),
})

export const WebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(EntrySchema),
})

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>
export type WebhookMessage = z.infer<typeof MessageSchema>
export type WebhookStatus = z.infer<typeof StatusSchema>
export type WebhookUserAction = z.infer<typeof UserActionSchema>
