/**
 * Domain vocabulary for Prime Next Logistics Ltd — the single place that decides what a
 * status means, what may follow it, and who is allowed to see which module. Screens read
 * from here instead of hard-coding strings, so the lifecycle stays consistent everywhere.
 *
 * One identifier: a job's id IS its tracking number. It is issued the moment the request is
 * raised, so the customer can follow the consignment from the first minute and nobody has
 * to reconcile two numbers for the same cargo.
 */

export const CURRENCY = 'NGN'
export const CURRENCY_SYMBOL = '₦'
export const ID_PREFIX = 'PNL'

/** Nigerian VAT, charged on freight and handling. */
export const VAT_RATE = 0.075

/** PNL104821 — quotable on the phone, scannable on a label, unique for the life of the job. */
export const formatWaybill = (seq, prefix = ID_PREFIX) => prefix + String(seq).padStart(6, '0')

/* ── Services ──────────────────────────────────────────────────────────────────
 * The lines Prime Next Logistics actually sells, each priced on its own basis: air moves
 * on chargeable weight, ocean on volume or box, haulage on tonnage, warehousing on pallets
 * and clearing per declaration. `unit` is what the order form asks for and what the rate
 * multiplies.
 *
 * Manning (crew management) is a contract service, not a consignment, so it lives on the
 * website as a service page rather than as a bookable job here.
 */
export const SERVICES = [
  {
    id: 'air_freight', label: 'Air Freight', short: 'Air',
    unit: 'kg', unitLabel: 'Chargeable weight', unitShort: 'kg', step: 0.1, minQty: 0.5, defaultQty: 50,
    base: 45000, perUnit: 2850, handlingPerPiece: 4500, fuelSurcharge: true, eta: 5,
  },
  {
    id: 'ocean_lcl', label: 'Ocean Freight (LCL)', short: 'Ocean LCL',
    unit: 'cbm', unitLabel: 'Volume', unitShort: 'CBM', step: 0.1, minQty: 1, defaultQty: 5,
    base: 210000, perUnit: 78000, handlingPerPiece: 12000, fuelSurcharge: true, eta: 35,
  },
  {
    id: 'ocean_fcl', label: 'Ocean Freight (FCL)', short: 'Ocean FCL',
    unit: 'container', unitLabel: 'Containers (20ft equivalent)', unitShort: 'TEU', step: 1, minQty: 1, defaultQty: 1,
    base: 180000, perUnit: 2450000, handlingPerPiece: 0, fuelSurcharge: true, eta: 32,
  },
  {
    id: 'door_to_door', label: '4PL & Door-to-Door', short: 'Door-to-Door',
    unit: 'kg', unitLabel: 'Chargeable weight', unitShort: 'kg', step: 0.1, minQty: 0.5, defaultQty: 25,
    base: 68000, perUnit: 3600, handlingPerPiece: 5500, fuelSurcharge: true, eta: 12,
  },
  {
    id: 'haulage', label: 'Inland Haulage', short: 'Haulage',
    unit: 'tonne', unitLabel: 'Load', unitShort: 't', step: 0.5, minQty: 1, defaultQty: 5,
    base: 125000, perUnit: 18500, handlingPerPiece: 0, fuelSurcharge: true, eta: 3,
  },
  {
    id: 'customs', label: 'Customs Clearing', short: 'Clearing',
    unit: 'declaration', unitLabel: 'Declarations', unitShort: 'decl.', step: 1, minQty: 1, defaultQty: 1,
    base: 185000, perUnit: 95000, handlingPerPiece: 0, fuelSurcharge: false, eta: 7,
  },
  {
    id: 'warehousing', label: 'Warehousing', short: 'Warehousing',
    unit: 'pallet', unitLabel: 'Pallets per week', unitShort: 'plt', step: 1, minQty: 1, defaultQty: 10,
    base: 35000, perUnit: 7500, handlingPerPiece: 0, fuelSurcharge: false, eta: 1,
  },
]
export const serviceById = (id) => SERVICES.find((s) => s.id === id) || SERVICES[0]
export const serviceLabel = (id) => serviceById(id).label
export const serviceShort = (id) => serviceById(id).short

/* ── Dimensions ────────────────────────────────────────────────────────────────
 * Air freight bills the greater of gross and volumetric weight, and ocean LCL bills
 * volume outright — so measuring the boxes is not a nicety, it is how the price is
 * arrived at. 5000 is the standard IATA divisor for centimetres.
 */
export const VOLUMETRIC_DIVISOR = 5000
export const LENGTH_UNITS = { cm: 1, in: 2.54, ft: 30.48 }

/** True when measuring boxes changes what this service charges. */
export const usesDimensions = (serviceId) => ['kg', 'cbm'].includes(serviceById(serviceId).unit)

export function measureBoxes(boxes = [], unit = 'cm') {
  const toCm = LENGTH_UNITS[unit] || 1
  let cm3 = 0
  let pieces = 0
  boxes.forEach((b) => {
    const l = (Number(b.l) || 0) * toCm
    const w = (Number(b.w) || 0) * toCm
    const h = (Number(b.h) || 0) * toCm
    const qty = Math.max(1, Number(b.qty) || 1)
    cm3 += l * w * h * qty
    pieces += qty
  })
  return { pieces, cbm: cm3 / 1e6, volumetricKg: cm3 / VOLUMETRIC_DIVISOR }
}

/**
 * What the consignment is actually billed on once the boxes are measured: the greater of
 * gross and volumetric for weight-rated services, the measured volume for ocean LCL, and
 * the entered figure for everything else.
 */
export function chargeableQuantity(serviceId, entered, measured) {
  const s = serviceById(serviceId)
  const qty = Number(entered) || 0
  if (!measured) return qty
  if (s.unit === 'kg') return Math.max(qty, measured.volumetricKg)
  if (s.unit === 'cbm') return measured.cbm > 0 ? measured.cbm : qty
  return qty
}

/* ── Order / consignment status ────────────────────────────────────────────── */
export const STATUS = {
  requested:        { label: 'Requested',        tone: 'amber',  group: 'requests' },
  confirmed:        { label: 'Confirmed',        tone: 'navy',   group: 'active' },
  picked_up:        { label: 'Collected',        tone: 'navy',   group: 'active' },
  in_transit:       { label: 'In Transit',       tone: 'cyan',   group: 'active' },
  out_for_delivery: { label: 'Out for Delivery', tone: 'violet', group: 'active' },
  delivered:        { label: 'Delivered',        tone: 'green',  group: 'completed' },
  exception:        { label: 'Exception',        tone: 'red',    group: 'active' },
  rejected:         { label: 'Rejected',         tone: 'slate',  group: 'closed' },
  cancelled:        { label: 'Cancelled',        tone: 'slate',  group: 'closed' },
}
export const STATUS_KEYS = Object.keys(STATUS)
export const statusLabel = (k) => (STATUS[k] ? STATUS[k].label : k)
export const isOpen = (k) => !['delivered', 'cancelled', 'rejected'].includes(k)
export const isLive = (k) => ['confirmed', 'picked_up', 'in_transit', 'out_for_delivery', 'exception'].includes(k)

/** Which statuses an operator may move a job to next — keeps the board honest. */
export const NEXT_STATUS = {
  requested:        ['confirmed', 'rejected'],
  confirmed:        ['picked_up', 'exception', 'cancelled'],
  picked_up:        ['in_transit', 'exception'],
  in_transit:       ['out_for_delivery', 'exception'],
  out_for_delivery: ['delivered', 'exception'],
  exception:        ['in_transit', 'out_for_delivery', 'cancelled'],
  delivered:        [],
  rejected:         [],
  cancelled:        [],
}

/* ── Tracking milestones ───────────────────────────────────────────────────────
 * Mirrors a West African forwarding job: collection, export handling, the long haul,
 * Nigeria Customs and the terminal, then final delivery.
 */
export const MILESTONES = {
  order_placed:        'Job request raised',
  order_confirmed:     'Booking confirmed',
  pickup_scheduled:    'Collection scheduled',
  picked_up:           'Collected from shipper',
  at_origin_hub:       'Received at origin warehouse',
  docs_received:       'Shipping documents received',
  departed_origin:     'Departed origin',
  in_transit:          'In transit',
  arrived_port:        'Arrived at port of discharge',
  customs_clearance:   'Nigeria Customs clearance',
  duty_paid:           'Duty and terminal charges paid',
  released_terminal:   'Released from terminal',
  out_for_delivery:    'Out for delivery',
  delivery_attempted:  'Delivery attempted',
  delivered:           'Delivered',
  exception:           'Exception raised',
  rejected:            'Request rejected',
  cancelled:           'Job cancelled',
}
export const MILESTONE_KEYS = Object.keys(MILESTONES)
export const milestoneLabel = (k) => (MILESTONES[k] ? MILESTONES[k] : k)

/** The status a job lands on when a given milestone is logged. */
export const MILESTONE_STATUS = {
  order_placed: 'requested',
  order_confirmed: 'confirmed',
  pickup_scheduled: 'confirmed',
  picked_up: 'picked_up',
  at_origin_hub: 'in_transit',
  docs_received: 'in_transit',
  departed_origin: 'in_transit',
  in_transit: 'in_transit',
  arrived_port: 'in_transit',
  customs_clearance: 'in_transit',
  duty_paid: 'in_transit',
  released_terminal: 'in_transit',
  out_for_delivery: 'out_for_delivery',
  delivery_attempted: 'exception',
  delivered: 'delivered',
  exception: 'exception',
  rejected: 'rejected',
  cancelled: 'cancelled',
}

/** Happy-path order of milestones, used to draw the progress rail on a job. */
export const MILESTONE_RAIL = [
  'order_placed', 'order_confirmed', 'picked_up', 'at_origin_hub', 'departed_origin',
  'in_transit', 'arrived_port', 'customs_clearance', 'released_terminal',
  'out_for_delivery', 'delivered',
]

/* ── Quotation requests ────────────────────────────────────────────────────── */
export const QUOTE_STATUS = {
  new:      { label: 'Awaiting quote', tone: 'amber' },
  quoted:   { label: 'Quoted',         tone: 'navy' },
  accepted: { label: 'Accepted',       tone: 'green' },
  declined: { label: 'Declined',       tone: 'slate' },
  expired:  { label: 'Expired',        tone: 'red' },
}

/* ── Branches (the network behind the website's "Our Network" page) ────────── */
export const BRANCH_TYPES = {
  hq:       { label: 'Head office' },
  port:     { label: 'Port office' },
  hub:      { label: 'Warehouse hub' },
  depot:    { label: 'Regional depot' },
  agent:    { label: 'Overseas agent' },
}

/* ── Modules & access levels (brief, pages 5–6) ────────────────────────────── */

/** Everything an Administration User can be granted. */
export const ADMIN_MODULES = [
  { id: 'analytics',      label: 'Analytics & Reports',  path: '/analytics' },
  { id: 'create_order',   label: 'Create Order',         path: '/create-order' },
  { id: 'order_requests', label: 'Order Requests',       path: '/orders' },
  { id: 'quotations',     label: 'Quotation Requests',   path: '/quotations' },
  { id: 'shipments',      label: 'Shipment Tracking',    path: '/shipments' },
  { id: 'customers',      label: 'Customer Management',  path: '/customers' },
  { id: 'invoices',       label: 'Invoices',             path: '/invoices' },
]

/** Held by Super Administrators, and grantable by them to an Administration User. */
export const SUPER_MODULES = [
  { id: 'users',         label: 'Users & Permissions',      path: '/users' },
  { id: 'branches',      label: 'Branches & Network',       path: '/branches' },
  { id: 'content',       label: 'Content Management',       path: '/content' },
  { id: 'notifications', label: 'Email Notifications',      path: '/notifications' },
  { id: 'chatbot',       label: 'AI Chatbot Configuration', path: '/chatbot' },
  { id: 'settings',      label: 'System Settings',          path: '/settings' },
]

export const MODULES = [...ADMIN_MODULES, ...SUPER_MODULES]
export const ALL_MODULES = MODULES.map((m) => m.id)
export const moduleById = (id) => MODULES.find((m) => m.id === id)
export const moduleLabel = (id) => {
  const m = moduleById(id)
  return m ? m.label : id
}

/**
 * Super Administrators hold every module implicitly (brief: "complete control").
 * Administration Users get an explicit, editable list — by default the operational
 * sections, with the administration modules reserved for Super Administrators.
 */
export const ROLES = {
  super_admin: {
    label: 'Super Administrator',
    locked: true,
    modules: ALL_MODULES,
    blurb: 'Complete control over the operation plus user creation, branch management, website content, tracking updates and chatbot configuration.',
  },
  admin: {
    label: 'Administration User',
    locked: false,
    modules: ADMIN_MODULES.map((m) => m.id),
    blurb: 'Day-to-day operations: jobs, quotations, consignment tracking, customers, invoicing and reporting.',
  },
}
export const roleLabel = (r) => (ROLES[r] ? ROLES[r].label : r)

export const can = (user, moduleId) => {
  if (!user) return false
  if (user.role === 'super_admin') return true
  return (user.permissions || []).includes(moduleId)
}

/* ── Automated email notifications (brief, page 6) ─────────────────────────── */
export const EMAIL_EVENTS = {
  customer_registration: { label: 'Customer registration', subject: 'Welcome to Prime Next Logistics' },
  shipment_creation:     { label: 'Job confirmation',      subject: 'Your consignment {waybill} has been booked' },
  shipment_update:       { label: 'Consignment update',    subject: 'Update on consignment {waybill}' },
  delivery_confirmation: { label: 'Delivery confirmation', subject: 'Delivered: consignment {waybill}' },
  contact_enquiry:       { label: 'Contact enquiry',       subject: 'We received your enquiry' },
  quote_request:         { label: 'Quote request',         subject: 'Your quote from Prime Next Logistics' },
  invoice_issued:        { label: 'Invoice issued',        subject: 'Invoice {invoice} for your consignment' },
}

export const INVOICE_STATUS = {
  draft: { label: 'Draft', tone: 'slate' },
  sent:  { label: 'Sent',  tone: 'navy' },
  paid:  { label: 'Paid',  tone: 'green' },
  void:  { label: 'Void',  tone: 'red' },
}

export const CUSTOMER_STATUS = {
  pending:   { label: 'Pending approval', tone: 'amber' },
  active:    { label: 'Active',           tone: 'green' },
  suspended: { label: 'Suspended',        tone: 'red' },
}

/**
 * Rate engine shared by the booking form, the quotation desk and the invoice generator, so
 * the price a customer is told is the price that lands on the invoice. Amounts are whole
 * Naira — kobo has no place on a freight invoice.
 */
export function quote({ serviceId, quantity = 1, pieces = 1, insured = false, declaredValue = 0 }) {
  const s = serviceById(serviceId)
  const qty = Math.max(s.minQty, Number(quantity) || 0)
  const naira = (n) => Math.round(n)

  const freight = naira(s.base + s.perUnit * qty)
  const handling = naira(Math.max(0, (Number(pieces) || 1) - 1) * s.handlingPerPiece)
  const insurance = insured ? naira(Math.max(15000, (Number(declaredValue) || 0) * 0.015)) : 0
  const fuel = s.fuelSurcharge ? naira((freight + handling) * 0.12) : 0
  const subtotal = freight + handling + insurance + fuel
  const vat = naira(subtotal * VAT_RATE)

  const lines = [{ label: s.label + ' — ' + qty + ' ' + s.unitShort, amount: freight }]
  if (handling) lines.push({ label: 'Multi-piece handling (' + pieces + ' pieces)', amount: handling })
  if (insurance) lines.push({ label: 'Cargo insurance', amount: insurance })
  if (fuel) lines.push({ label: 'Fuel and security surcharge (12%)', amount: fuel })
  lines.push({ label: 'VAT (7.5%)', amount: vat })

  return { lines, subtotal, vat, total: subtotal + vat, etaDays: s.eta }
}
