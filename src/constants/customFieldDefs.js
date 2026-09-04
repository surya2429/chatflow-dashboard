/* ─── Default custom field definitions ───────────────────────────────
   Created in Settings → Custom Fields. Shared globally (via AppContext)
   so the Inbox info panel and its filters stay in sync with whatever
   fields a workspace has defined. */
export const DEFAULT_CUSTOM_FIELDS = {
  contact: [
    { id: 1, name: 'Company Size', key: 'company_size', type: 'dropdown', required: false, options: ['1-10', '11-50', '51-200', '201+'] },
    { id: 2, name: 'Industry',     key: 'industry',      type: 'text',     required: false },
    { id: 3, name: 'Lead Score',   key: 'lead_score',    type: 'number',   required: false },
    { id: 4, name: 'Date of Birth',key: 'dob',            type: 'date',     required: false },
    { id: 5, name: 'Newsletter',   key: 'newsletter',    type: 'boolean',  required: false },
  ],
  conversation: [
    { id: 6, name: 'Priority',    key: 'priority',    type: 'dropdown', required: false, options: ['Low', 'Medium', 'High', 'Urgent'] },
    { id: 7, name: 'Order ID',    key: 'order_id',    type: 'text',     required: false },
    { id: 8, name: 'Product SKU', key: 'product_sku', type: 'text',     required: false },
  ],
}
