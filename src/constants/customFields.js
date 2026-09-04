/* ─── Chatbot/workspace-collected data — source list for integration field mapping ── */

export const STANDARD_CONTACT_FIELDS = [
  { key: 'contact.name',     label: 'Full Name', group: 'Standard' },
  { key: 'contact.phone',    label: 'Phone',      group: 'Standard' },
  { key: 'contact.email',    label: 'Email',      group: 'Standard' },
  { key: 'contact.company',  label: 'Company',    group: 'Standard' },
  { key: 'contact.city',     label: 'City',       group: 'Standard' },
  { key: 'contact.language', label: 'Language',   group: 'Standard' },
  { key: 'contact.tags',     label: 'Tags',       group: 'Standard' },
]

export const CUSTOM_ATTRIBUTE_FIELDS = [
  { key: 'custom.company_size', label: 'Company Size',      group: 'Custom Fields' },
  { key: 'custom.industry',     label: 'Industry',          group: 'Custom Fields' },
  { key: 'custom.lead_score',   label: 'Lead Score',        group: 'Custom Fields' },
  { key: 'custom.dob',          label: 'Date of Birth',     group: 'Custom Fields' },
  { key: 'custom.newsletter',   label: 'Newsletter Opt-in', group: 'Custom Fields' },
  { key: 'custom.priority',     label: 'Priority',          group: 'Custom Fields' },
  { key: 'custom.order_id',     label: 'Order ID',          group: 'Custom Fields' },
  { key: 'custom.product_sku',  label: 'Product SKU',       group: 'Custom Fields' },
]

/* Mirrors real "Ask Question" flow nodes (src/pages/FlowSetup.jsx) — each one   */
/* prompts the user and stores the reply in a {{variable}}, exactly as a flow    */
/* builder would name it via "Save Response As".                                */
export const FLOW_VARIABLE_FIELDS = [
  { key: 'flow.user_name',       label: '"What\'s your name?" → {{user_name}}',            group: 'Flow Automation' },
  { key: 'flow.user_email',      label: '"What\'s your email?" → {{user_email}}',           group: 'Flow Automation' },
  { key: 'flow.user_phone',      label: '"What\'s your phone number?" → {{user_phone}}',    group: 'Flow Automation' },
  { key: 'flow.user_company',    label: '"Which company are you from?" → {{user_company}}', group: 'Flow Automation' },
  { key: 'flow.user_choice',     label: '"How can I help you today?" → {{user_choice}}',    group: 'Flow Automation' },
  { key: 'flow.appointment_date',label: '"Pick a date & time" → {{appointment_date}}',      group: 'Flow Automation' },
  { key: 'flow.budget',          label: '"What\'s your budget?" → {{budget}}',              group: 'Flow Automation' },
  { key: 'flow.ai_response',     label: 'AI-generated reply → {{ai_response}}',             group: 'Flow Automation' },
]

export const SOURCE_FIELDS = [
  ...STANDARD_CONTACT_FIELDS,
  ...CUSTOM_ATTRIBUTE_FIELDS,
  ...FLOW_VARIABLE_FIELDS,
]

export const SOURCE_FIELD_GROUPS = ['Standard', 'Custom Fields', 'Flow Automation']
