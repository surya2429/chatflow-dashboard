import { STATUS, INVOICE_STATUS, CUSTOMER_STATUS } from '../lib/domain'
import { Badge } from './ui'

export function StatusBadge({ status }) {
  const s = STATUS[status]
  return <Badge tone={s ? s.tone : 'slate'} dot>{s ? s.label : status}</Badge>
}

export function InvoiceBadge({ status }) {
  const s = INVOICE_STATUS[status]
  return <Badge tone={s ? s.tone : 'slate'} dot>{s ? s.label : status}</Badge>
}

export function CustomerBadge({ status }) {
  const s = CUSTOMER_STATUS[status]
  return <Badge tone={s ? s.tone : 'slate'} dot>{s ? s.label : status}</Badge>
}

export function ContentBadge({ status }) {
  return <Badge tone={status === 'published' ? 'green' : 'slate'} dot>{status === 'published' ? 'Published' : 'Draft'}</Badge>
}
