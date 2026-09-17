/**
 * Deterministic seed data for the Prime Next Logistics dashboard.
 *
 * Every screen in the brief needs a believable operational history behind it — six months
 * of jobs, their tracking milestones, the invoices raised against them and the emails those
 * events fired. Generating that from a fixed seed keeps demos reproducible: the same figures
 * appear in Analytics, on the job board and in each consignment's history.
 */
import { SERVICES, quote, ROLES, ALL_MODULES, formatWaybill } from '../lib/domain'

/* mulberry32 — small deterministic PRNG so every reset rebuilds the identical dataset. */
function rng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The network behind the website's "Our Network" page: the Lagos port complex the business
 * is built around, regional depots across Nigeria, and the overseas agents that originate
 * import traffic.
 */
const BRANCH_SEED = [
  { code: 'APP', name: 'Apapa Head Office',           city: 'Apapa, Lagos',      country: 'Nigeria',        type: 'hq',    manager: 'Adebayo Okonkwo',  staff: 42, opened: '2016-04-11', address: '25a Liverpool Road, Apapa' },
  { code: 'TIN', name: 'Tin Can Island Port Office',  city: 'Lagos',             country: 'Nigeria',        type: 'port',  manager: 'Ibrahim Danjuma',  staff: 28, opened: '2017-02-06', address: 'Tin Can Island Port Complex' },
  { code: 'LPC', name: 'Lagos Port Complex Office',   city: 'Apapa, Lagos',      country: 'Nigeria',        type: 'port',  manager: 'Chinedu Nwosu',    staff: 24, opened: '2016-09-19', address: 'Wharf Road, Apapa' },
  { code: 'MMA', name: 'MMIA Cargo Terminal',         city: 'Ikeja, Lagos',      country: 'Nigeria',        type: 'hub',   manager: 'Yewande Afolabi',  staff: 19, opened: '2018-06-04', address: 'Murtala Muhammed Cargo Terminal' },
  { code: 'ONN', name: 'Onne Port Office',            city: 'Onne, Rivers',      country: 'Nigeria',        type: 'port',  manager: 'Tamuno Briggs',    staff: 16, opened: '2019-03-25', address: 'Federal Ocean Terminal, Onne' },
  { code: 'PHC', name: 'Port Harcourt Depot',         city: 'Port Harcourt',     country: 'Nigeria',        type: 'depot', manager: 'Ngozi Eze',        staff: 13, opened: '2019-08-12', address: 'Trans-Amadi Industrial Layout' },
  { code: 'ABV', name: 'Abuja Regional Office',       city: 'Abuja',             country: 'Nigeria',        type: 'depot', manager: 'Halima Bello',     staff: 11, opened: '2020-05-18', address: 'Idu Industrial District' },
  { code: 'KAN', name: 'Kano Depot',                  city: 'Kano',              country: 'Nigeria',        type: 'depot', manager: 'Musa Aliyu',       staff: 9,  opened: '2021-01-27', address: 'Bompai Industrial Area' },
  { code: 'IBD', name: 'Ibadan Depot',                city: 'Ibadan',            country: 'Nigeria',        type: 'depot', manager: 'Segun Oyelaran',   staff: 8,  opened: '2021-10-04', address: 'Lagos–Ibadan Expressway, Ojoo' },
  { code: 'ONI', name: 'Onitsha Depot',               city: 'Onitsha',           country: 'Nigeria',        type: 'depot', manager: 'Obinna Okeke',     staff: 10, opened: '2022-03-21', address: 'Ochanja Industrial Layout' },
  { code: 'WAR', name: 'Warri Depot',                 city: 'Warri',             country: 'Nigeria',        type: 'depot', manager: 'Blessing Emenike', staff: 7,  opened: '2023-02-13', address: 'Enerhen Road, Warri' },
  { code: 'CAN', name: 'Guangzhou Agent',             city: 'Guangzhou',         country: 'China',          type: 'agent', manager: 'Wei Zhang',        staff: 6,  opened: '2019-11-08', address: 'Baiyun Logistics Park' },
  { code: 'DXB', name: 'Dubai Agent',                 city: 'Dubai',             country: 'United Arab Emirates', type: 'agent', manager: 'Karim Haddad', staff: 5, opened: '2020-09-14', address: 'Jebel Ali Free Zone' },
  { code: 'LHR', name: 'London Gateway',              city: 'London',            country: 'United Kingdom', type: 'agent', manager: 'Hannah Bennett',   staff: 5,  opened: '2021-06-02', address: 'Heathrow Cargo Centre' },
  { code: 'JFK', name: 'New York Gateway',            city: 'New York',          country: 'United States',  type: 'agent', manager: 'Marcus Whitfield', staff: 4,  opened: '2023-07-17', address: 'JFK Air Cargo Center' },
  { code: 'JNB', name: 'Johannesburg Agent',          city: 'Johannesburg',      country: 'South Africa',   type: 'agent', manager: 'Thabo Molefe',     staff: 3,  opened: '2024-05-06', address: 'OR Tambo Cargo Precinct' },
]

const FIRST = ['Adebayo', 'Chiamaka', 'Emeka', 'Folasade', 'Ibrahim', 'Ngozi', 'Olumide', 'Aisha',
  'Chinedu', 'Yewande', 'Tunde', 'Amaka', 'Musa', 'Funmilayo', 'Obinna', 'Halima', 'Segun',
  'Blessing', 'Kelechi', 'Zainab', 'Bisi', 'Uche', 'Sani', 'Temitope', 'Ifeanyi', 'Hauwa',
  'Gbenga', 'Nkechi', 'Abdullahi', 'Oluwaseun', 'Chidi', 'Fatima']
const LAST = ['Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Musa', 'Okonkwo', 'Nwosu', 'Ibrahim',
  'Afolabi', 'Chukwu', 'Yusuf', 'Ogunleye', 'Obi', 'Bello', 'Oyelaran', 'Sani', 'Adeleke',
  'Ugochukwu', 'Danjuma', 'Olawale', 'Iheanacho', 'Abubakar', 'Oladipo', 'Emenike', 'Lawal',
  'Okeke', 'Aliyu', 'Babatunde', 'Nnaji', 'Akinyemi']
const COMPANIES = ['Zenith Trading Co', 'Lekki Retail Ltd', 'Sahara Foods Nigeria', 'Ikeja Electronics',
  'Aba Textiles Ltd', 'Niger Steel Works', 'Harmattan Pharma', 'Onitsha Auto Parts',
  'Kano Agro Exports', 'Delta Oilfield Supplies', 'Yaba Tech Imports', 'Calabar Seafoods',
  'Jos Minerals Ltd', 'Abuja Medical Supplies', 'Rivers Marine Services', 'Kaduna Leatherworks',
  'Ibadan Cocoa Traders', 'Victoria Island Interiors', '', '', '']
const CARGO = ['General cargo', 'Machinery parts', 'Pharmaceuticals', 'Textiles and apparel',
  'Consumer electronics', 'Automotive spares', 'Building materials', 'Agricultural produce',
  'Cocoa beans', 'Frozen foods', 'Industrial chemicals (non-haz)', 'Oilfield equipment',
  'Packaging materials', 'Solar panels and inverters', 'Generator sets', 'Medical consumables']
const LAGOS_STREETS = ['Liverpool Road, Apapa', 'Creek Road, Apapa', 'Burma Road, Apapa',
  'Point Road, Apapa', 'Adeola Odeku, Victoria Island', 'Ozumba Mbadiwe, Victoria Island',
  'Oba Akran Avenue, Ikeja', 'Kudirat Abiola Way, Oregun', 'Admiralty Way, Lekki',
  'Town Planning Way, Ilupeju']

const pad = (n, w) => String(n).padStart(w, '0')
const pick = (r, arr) => arr[Math.floor(r() * arr.length)]
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1))
const chance = (r, p) => r() < p

const iso = (d) => new Date(d).toISOString()
const addH = (d, h) => new Date(new Date(d).getTime() + h * 3600 * 1000)

/** A plausible consignment size for whatever the service actually measures. */
function qtyFor(r, service) {
  switch (service.unit) {
    case 'kg':        return Math.round((5 + Math.pow(r(), 2) * 2400) * 10) / 10
    case 'cbm':       return Math.round((1 + Math.pow(r(), 1.7) * 58) * 10) / 10
    case 'container': return int(r, 1, 6)
    case 'tonne':     return Math.round((1 + Math.pow(r(), 1.5) * 32) * 2) / 2
    case 'declaration': return int(r, 1, 4)
    case 'pallet':    return int(r, 1, 40)
    default:          return 1
  }
}

const ngPhone = (r) => '+234 ' + pick(r, ['703', '706', '803', '806', '813', '817', '818', '903', '905'])
  + ' ' + int(r, 100, 999) + ' ' + int(r, 1000, 9999)

export const SEED_NOW = new Date('2026-09-17T09:30:00Z')

export function buildSeed() {
  const r = rng(20260917)
  const now = SEED_NOW

  /* ── Branches ────────────────────────────────────────────────────────────── */
  const branches = BRANCH_SEED.map((b, i) => ({
    id: 'BRN-' + pad(i + 1, 3),
    code: b.code,
    name: b.name,
    city: b.city,
    country: b.country,
    type: b.type,
    manager: b.manager,
    staffCount: b.staff,
    phone: b.country === 'Nigeria' ? ngPhone(r) : '+' + int(r, 1, 99) + ' ' + int(r, 100, 999) + ' ' + int(r, 1000, 9999),
    address: b.address,
    status: i === 15 ? 'onboarding' : 'active',
    openedAt: iso(new Date(b.opened)),
  }))
  const routable = branches.filter((b) => b.status === 'active')
  const nigerian = routable.filter((b) => b.country === 'Nigeria')
  const overseas = routable.filter((b) => b.country !== 'Nigeria')

  /* ── Staff accounts ──────────────────────────────────────────────────────── */
  const users = [
    {
      id: 'USR-001', name: 'Adebayo Okonkwo', email: 'adebayo@primenextlogistics.com',
      role: 'super_admin', permissions: ALL_MODULES, status: 'active', branchId: 'BRN-001',
      title: 'Managing Director', password: 'admin',
      lastLogin: iso(addH(now, -1.5)), createdAt: iso(new Date('2026-01-08T08:00:00Z')),
    },
    {
      id: 'USR-002', name: 'Chiamaka Eze', email: 'chiamaka@primenextlogistics.com',
      role: 'admin', permissions: ROLES.admin.modules, status: 'active', branchId: 'BRN-001',
      title: 'Customer Service Lead', password: 'admin',
      lastLogin: iso(addH(now, -4)), createdAt: iso(new Date('2026-01-19T08:00:00Z')),
    },
    {
      id: 'USR-003', name: 'Ibrahim Danjuma', email: 'ibrahim@primenextlogistics.com',
      role: 'admin', permissions: ['analytics', 'order_requests', 'shipments'], status: 'active', branchId: 'BRN-002',
      title: 'Port Operations Supervisor — Tin Can', password: 'admin',
      lastLogin: iso(addH(now, -22)), createdAt: iso(new Date('2026-02-02T08:00:00Z')),
    },
    {
      id: 'USR-004', name: 'Folasade Adeyemi', email: 'folasade@primenextlogistics.com',
      role: 'admin', permissions: ['analytics', 'quotations', 'customers', 'invoices'], status: 'active', branchId: 'BRN-001',
      title: 'Commercial Desk', password: 'admin',
      lastLogin: iso(addH(now, -50)), createdAt: iso(new Date('2026-03-14T08:00:00Z')),
    },
    {
      id: 'USR-005', name: 'Musa Abubakar', email: 'musa@primenextlogistics.com',
      role: 'admin', permissions: ['analytics', 'invoices'], status: 'suspended', branchId: 'BRN-006',
      title: 'Finance (contract ended)', password: 'admin',
      lastLogin: iso(addH(now, -940)), createdAt: iso(new Date('2026-02-27T08:00:00Z')),
    },
  ]

  /* ── Customers (they sign in to the customer portal) ─────────────────────── */
  const customers = []
  for (let i = 0; i < 72; i++) {
    const first = pick(r, FIRST)
    const last = pick(r, LAST)
    const name = first + ' ' + last
    const company = pick(r, COMPANIES)
    const home = pick(r, nigerian)
    const daysAgo = Math.floor(Math.pow(r(), 1.5) * 220)
    const registeredAt = iso(addH(now, -(daysAgo * 24 + int(r, 0, 23))))
    const status = daysAgo < 4 && chance(r, 0.75) ? 'pending' : chance(r, 0.05) ? 'suspended' : 'active'
    customers.push({
      id: 'CUS-' + pad(1001 + i, 4),
      name,
      company,
      email: (first + '.' + last.replace(/\s+/g, '')).toLowerCase() + '@'
        + (company ? company.toLowerCase().replace(/[^a-z]/g, '') + '.com' : 'gmail.com'),
      password: 'customer',
      phone: ngPhone(r),
      city: home.city,
      country: home.country,
      branchId: home.id,
      address: int(r, 12, 240) + ' ' + pick(r, LAGOS_STREETS),
      accountType: company ? 'business' : 'individual',
      status,
      registeredAt,
      verified: status !== 'pending',
      notes: '',
    })
  }

  // One predictable portal login for demos, always active and with plenty of history.
  customers[0] = {
    ...customers[0],
    name: 'Ngozi Okafor',
    company: 'Lekki Retail Ltd',
    email: 'ngozi@lekkiretail.com',
    password: 'customer',
    phone: '+234 803 412 7788',
    city: 'Lagos',
    country: 'Nigeria',
    address: '14 Admiralty Way, Lekki Phase 1',
    accountType: 'business',
    status: 'active',
    verified: true,
    registeredAt: iso(addH(now, -210 * 24)),
  }

  /* ── Jobs, milestones, activity, invoices, emails ────────────────────────── */
  const orders = []
  const invoices = []
  const emails = []
  const activity = []
  let waybillSeq = 104000
  let invoiceSeq = 1

  const logEmail = (type, customer, at, meta = {}) => {
    emails.push({
      id: 'EML-' + pad(emails.length + 1, 5),
      type,
      to: customer.email,
      customerId: customer.id,
      at,
      status: chance(r, 0.975) ? 'delivered' : 'bounced',
      meta,
    })
  }

  customers.forEach((c) => {
    activity.push({
      id: 'ACT-' + pad(activity.length + 1, 5), customerId: c.id, actor: c.name,
      action: 'Registered an account on the website', at: c.registeredAt, kind: 'account',
    })
    logEmail('customer_registration', c, c.registeredAt)
  })

  const orderCount = 420
  for (let i = 0; i < orderCount; i++) {
    // The demo portal account gets a regular shipper's share of the book, so the customer
    // portal has a real history to show rather than a handful of stray jobs.
    const c = chance(r, 0.09) ? customers[0] : customers[int(r, 0, customers.length - 1)]
    const service = pick(r, SERVICES)

    // Import traffic originates overseas; domestic services move between Nigerian branches.
    const isImport = ['air_freight', 'ocean_lcl', 'ocean_fcl', 'door_to_door'].includes(service.id)
      && chance(r, 0.68)
    const origin = isImport ? pick(r, overseas) : pick(r, nigerian)
    // Guard on city, not just branch: Apapa holds two port offices, and "Apapa → Apapa"
    // is not a route anyone books.
    let dest = pick(r, nigerian)
    while (dest.city === origin.city) dest = pick(r, nigerian)

    const regAge = (now - new Date(c.registeredAt)) / 36e5
    // Biased hard toward recent days: a live operation carries far more jobs in the last
    // fortnight than in any single month of its back catalogue.
    const hoursAgo = Math.min(regAge - 1, Math.floor(Math.pow(r(), 1.9) * 24 * 175))
    if (hoursAgo < 1) continue
    const createdAt = iso(addH(now, -hoursAgo))

    const pieces = chance(r, 0.6) ? 1 : int(r, 2, 14)
    const quantity = qtyFor(r, service)
    const insured = chance(r, 0.38)
    const declaredValue = insured ? int(r, 900000, 85000000) : int(r, 80000, 6000000)
    const q = quote({ serviceId: service.id, quantity, pieces, insured, declaredValue })

    const transitHours = service.eta * 24
    const progress = hoursAgo / (transitHours * (0.75 + r() * 0.9))
    let finalStatus
    if (chance(r, 0.04)) finalStatus = 'cancelled'
    else if (progress >= 1) finalStatus = chance(r, 0.96) ? 'delivered' : 'exception'
    else if (progress >= 0.85) finalStatus = 'out_for_delivery'
    else if (progress >= 0.3) finalStatus = chance(r, 0.92) ? 'in_transit' : 'exception'
    else if (progress >= 0.15) finalStatus = 'picked_up'
    else if (progress >= 0.05) finalStatus = 'confirmed'
    else finalStatus = 'requested'
    if (finalStatus === 'requested' && chance(r, 0.12)) finalStatus = 'rejected'

    const clears = isImport || service.id === 'customs'
    const rail = ['order_placed']
    if (finalStatus === 'cancelled') rail.push('cancelled')
    else if (finalStatus === 'rejected') rail.push('rejected')
    else {
      const upto = {
        requested: 0, confirmed: 1, picked_up: 2, in_transit: 6,
        out_for_delivery: 9, delivered: 10, exception: 6,
      }[finalStatus]
      const full = ['order_placed', 'order_confirmed', 'picked_up', 'at_origin_hub', 'departed_origin',
        'in_transit', 'arrived_port', 'customs_clearance', 'released_terminal', 'out_for_delivery', 'delivered']
      for (let k = 1; k <= upto; k++) {
        const m = full[k]
        // Purely domestic moves never touch a port of discharge or Customs.
        if (!clears && ['arrived_port', 'customs_clearance', 'released_terminal'].includes(m)) continue
        rail.push(m)
      }
      if (finalStatus === 'exception') rail.push(chance(r, 0.5) ? 'delivery_attempted' : 'exception')
    }

    // Roughly one job in six runs past its promised ETA, so on-time performance is a number
    // worth reporting rather than a flat 100%.
    const paceFactor = chance(r, 0.17) ? 1.06 + r() * 0.55 : 0.58 + r() * 0.38
    const span = Math.max(2, Math.min(hoursAgo, transitHours * paceFactor))
    const id = formatWaybill(waybillSeq++)

    const milestones = rail.map((code, k) => {
      const at = iso(addH(createdAt, (span / Math.max(1, rail.length - 1)) * k))
      const where = k === 0 ? origin : k >= rail.length - 2 ? dest : chance(r, 0.5) ? origin : dest
      return {
        id: 'MS-' + id + '-' + pad(k + 1, 2),
        code,
        at,
        location: where.city + ', ' + where.country,
        hub: where.code,
        note: code === 'delivery_attempted' ? 'Consignee unavailable — re-attempt scheduled'
          : code === 'exception' ? 'Consignee address incomplete, customer service contacted'
          : code === 'customs_clearance' ? 'Held for Nigeria Customs examination'
          : code === 'rejected' ? 'Restricted cargo — import prohibition list' : '',
        by: k === 0 ? c.name : pick(r, users).name,
      }
    })

    const delivered = finalStatus === 'delivered'
    const lastAt = milestones[milestones.length - 1].at
    const order = {
      id,
      customerId: c.id,
      serviceId: service.id,
      status: finalStatus,
      createdAt,
      updatedAt: lastAt,
      placedBy: chance(r, 0.6) ? 'customer' : 'staff',
      origin: { city: origin.city, country: origin.country, hub: origin.code, branchId: origin.id, address: origin.address },
      destination: {
        city: dest.city, country: dest.country, hub: dest.code, branchId: dest.id,
        address: int(r, 10, 240) + ' ' + pick(r, LAGOS_STREETS),
      },
      receiver: { name: pick(r, FIRST) + ' ' + pick(r, LAST), phone: ngPhone(r) },
      pieces,
      quantity,
      contents: pick(r, CARGO),
      declaredValue,
      insured,
      paymentMode: chance(r, 0.65) ? 'Account (invoiced)' : 'Pay on collection',
      amount: q.total,
      etaAt: iso(addH(createdAt, service.eta * 24)),
      deliveredAt: delivered ? lastAt : null,
      pod: delivered
        ? {
            signedBy: chance(r, 0.85) ? pick(r, FIRST) + ' ' + pick(r, LAST) : 'Left with warehouse reception',
            signatureAt: lastAt,
            photo: chance(r, 0.45),
            note: '',
          }
        : null,
      milestones,
      documents: chance(r, 0.45)
        ? [{
            id: 'DOC-' + pad(i, 4),
            name: pick(r, ['bill-of-lading.pdf', 'commercial-invoice.pdf', 'packing-list.pdf', 'form-m.pdf', 'paar.pdf']),
            size: int(r, 40, 420) + ' KB',
            at: createdAt,
          }]
        : [],
      notes: '',
    }
    orders.push(order)

    activity.push({
      id: 'ACT-' + pad(activity.length + 1, 5), customerId: c.id,
      actor: order.placedBy === 'customer' ? c.name : pick(r, users).name,
      action: 'Raised job request ' + id, at: createdAt, kind: 'order', orderId: id,
    })
    if (finalStatus !== 'requested' && finalStatus !== 'rejected') {
      logEmail('shipment_creation', c, milestones[1] ? milestones[1].at : createdAt, { waybill: id, orderId: id })
    }
    if (['in_transit', 'out_for_delivery', 'exception'].includes(finalStatus)) {
      logEmail('shipment_update', c, lastAt, { waybill: id, orderId: id })
    }
    if (delivered) logEmail('delivery_confirmation', c, lastAt, { waybill: id, orderId: id })

    if (!['requested', 'rejected', 'cancelled'].includes(finalStatus) && chance(r, 0.82)) {
      const issuedAt = milestones[Math.min(2, milestones.length - 1)].at
      const status = delivered ? (chance(r, 0.7) ? 'paid' : 'sent') : chance(r, 0.25) ? 'paid' : chance(r, 0.8) ? 'sent' : 'draft'
      const inv = {
        id: 'INV-2026-' + pad(invoiceSeq++, 4),
        orderId: id,
        customerId: c.id,
        issuedAt,
        dueAt: iso(addH(issuedAt, 21 * 24)),
        status,
        lines: q.lines,
        subtotal: q.subtotal,
        vat: q.vat,
        total: q.total,
        paidAt: status === 'paid' ? iso(addH(issuedAt, int(r, 12, 480))) : null,
      }
      invoices.push(inv)
      if (status !== 'draft') logEmail('invoice_issued', c, issuedAt, { invoice: inv.id, orderId: id })
    }
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  /* ── Quotation requests (the website's "Get Free Quote" form) ────────────── */
  const quotes = []
  for (let i = 0; i < 34; i++) {
    const c = customers[int(r, 0, customers.length - 1)]
    const at = iso(addH(now, -int(r, 2, 80 * 24)))
    const service = pick(r, SERVICES)
    const isImport = chance(r, 0.6)
    const origin = isImport ? pick(r, overseas) : pick(r, nigerian)
    let dest = pick(r, nigerian)
    while (dest.city === origin.city) dest = pick(r, nigerian)
    const quantity = qtyFor(r, service)
    const pieces = chance(r, 0.5) ? 1 : int(r, 2, 12)
    const q = quote({ serviceId: service.id, quantity, pieces })

    const age = (now - new Date(at)) / 36e5
    let status = 'new'
    if (age > 24) status = chance(r, 0.85) ? 'quoted' : 'new'
    if (status === 'quoted' && age > 72) status = chance(r, 0.45) ? 'accepted' : chance(r, 0.5) ? 'declined' : 'quoted'
    if (status === 'quoted' && age > 24 * 30) status = 'expired'

    quotes.push({
      id: 'QT-' + pad(1001 + i, 4),
      customerId: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
      serviceId: service.id,
      origin: { city: origin.city, country: origin.country, hub: origin.code },
      destination: { city: dest.city, country: dest.country, hub: dest.code },
      quantity,
      pieces,
      frequency: pick(r, ['One-off', 'Weekly', 'Fortnightly', 'Monthly']),
      message: 'Please quote ' + pieces + ' × ' + pick(r, CARGO).toLowerCase()
        + ' from ' + origin.city + ' to ' + dest.city + '.',
      status,
      at,
      quotedAmount: status === 'new' ? null : Math.round(q.total * (0.92 + r() * 0.16)),
      quotedAt: status === 'new' ? null : iso(addH(at, int(r, 2, 36))),
      quotedBy: status === 'new' ? null : pick(r, users).name,
      validUntil: status === 'new' ? null : iso(addH(at, 30 * 24)),
      note: '',
      orderId: null,
    })
    logEmail('quote_request', c, at)
  }
  quotes.sort((a, b) => new Date(b.at) - new Date(a.at))

  /* ── Contact enquiries (the website's contact form) ──────────────────────── */
  const enquiries = []
  for (let i = 0; i < 22; i++) {
    const c = customers[int(r, 0, customers.length - 1)]
    const at = iso(addH(now, -int(r, 2, 70 * 24)))
    enquiries.push({
      id: 'ENQ-' + pad(101 + i, 4),
      customerId: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      subject: pick(r, ['Customs clearing', 'Warehousing rates', 'Corporate account', 'Demurrage charges', 'Damaged cargo']),
      message: pick(r, [
        'Do you handle Form M and PAAR processing for first-time importers?',
        'What are your monthly warehousing rates for 20 pallets in Apapa?',
        'Can I open a corporate account with consolidated monthly invoicing?',
        'Our container has been at Tin Can for nine days — can you help with demurrage?',
        'Two cartons arrived damaged last week. How do I open a cargo insurance claim?',
      ]),
      status: chance(r, 0.6) ? 'responded' : 'new',
      at,
    })
    logEmail('contact_enquiry', c, at)
  }
  enquiries.sort((a, b) => new Date(b.at) - new Date(a.at))

  emails.sort((a, b) => new Date(b.at) - new Date(a.at))
  activity.sort((a, b) => new Date(b.at) - new Date(a.at))

  /* ── Website content managed from the dashboard ──────────────────────────── */
  const servicePages = [
    { slug: 'air-freight', title: 'Air Freight' },
    { slug: 'ocean-freight', title: 'Ocean Freight' },
    { slug: '4pl-door-to-door', title: '4PL & Door-to-Door Services' },
    { slug: 'warehousing', title: 'Warehousing' },
    { slug: 'clearing-agency', title: 'Clearing Agency' },
    { slug: 'manning-services', title: 'Manning Services' },
  ].map((p, i) => ({
    ...p,
    id: 'SPG-' + (i + 1),
    type: 'service',
    status: i === 5 ? 'draft' : 'published',
    excerpt: 'Service page for the ' + p.title.toLowerCase() + ' line, with coverage, rate highlights and a quote form.',
    seoTitle: p.title + ' in Nigeria | Prime Next Logistics',
    seoDescription: p.title + ' from Apapa, Lagos — trusted, fast and reliable freight forwarding across West Africa.',
    updatedAt: iso(addH(now, -int(r, 6, 60 * 24))),
    updatedBy: pick(r, users).name,
  }))

  const sitePages = [
    'Home', 'About Us', 'Why Choose Us', 'Industries Served', 'Our Network', 'Careers',
    'Terms & Conditions', 'Contact Us',
  ].map((title, i) => ({
    id: 'PG-' + (i + 1),
    type: 'page',
    slug: title.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-'),
    title,
    status: 'published',
    excerpt: 'Corporate page — ' + title + '.',
    seoTitle: title + ' | Prime Next Logistics Ltd',
    seoDescription: title + ' at Prime Next Logistics Ltd, Apapa, Lagos.',
    updatedAt: iso(addH(now, -int(r, 6, 90 * 24))),
    updatedBy: pick(r, users).name,
  }))

  const blogs = [
    'Form M, PAAR and BA: the import documents Nigerian businesses keep getting wrong',
    'How to avoid demurrage at Tin Can Island and Apapa',
    'Air freight or ocean freight? Choosing for the Lagos trade lanes',
    'What the latest Nigeria Customs tariff changes mean for importers',
    'Warehousing in Apapa: what to look for in a bonded facility',
    'Guangzhou to Lagos: a practical guide to consolidating LCL cargo',
    'Peak season readiness for Nigerian retailers and distributors',
  ].map((title, i) => ({
    id: 'BLG-' + (i + 1),
    type: 'blog',
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title,
    author: pick(r, users).name,
    status: i > 4 ? 'draft' : 'published',
    excerpt: title + ' — practical guidance from the Prime Next Logistics operations team.',
    tags: [pick(r, ['customs', 'imports', 'ocean-freight', 'air-freight', 'warehousing', 'guides'])],
    views: i > 4 ? 0 : int(r, 120, 4800),
    updatedAt: iso(addH(now, -int(r, 3, 120 * 24))),
    updatedBy: pick(r, users).name,
  }))

  const faqs = [
    ['How do I track my consignment?', 'Enter the consignment number from your confirmation email into the tracking box on the homepage, or sign in to your customer portal. Milestones update as your cargo moves.'],
    ['Do I have to pay online when booking?', 'No. Job requests are submitted without online payment — our team confirms the rate and raises an invoice against your account.'],
    ['Which ports and terminals do you work through?', 'Lagos Port Complex and Tin Can Island in Apapa, Onne and Port Harcourt in Rivers State, and MMIA cargo terminal for air freight.'],
    ['How long does clearing take at Apapa?', 'Typically five to nine working days from vessel discharge, depending on Customs examination and terminal release. We update you at every stage.'],
    ['Do you handle Form M and PAAR processing?', 'Yes. Our licensed clearing team coordinates Form M, PAAR, duty assessment and terminal release on your behalf.'],
    ['What items cannot be imported?', 'Anything on the Nigeria Customs import prohibition list, plus hazardous goods without prior arrangement. Contact us if you are unsure.'],
    ['Do you provide proof of delivery?', 'Yes. A delivery confirmation email is sent automatically, and signed proof of delivery is recorded against your consignment.'],
    ['How do I open a corporate account?', 'Submit the quote request form and our commercial desk will set up consolidated monthly invoicing.'],
  ].map(([question, answer], i) => ({
    id: 'FAQ-' + (i + 1),
    question,
    answer,
    category: pick(r, ['Tracking', 'Booking', 'Billing', 'Customs', 'Coverage']),
    status: i === 7 ? 'draft' : 'published',
    order: i + 1,
    updatedAt: iso(addH(now, -int(r, 3, 100 * 24))),
    updatedBy: pick(r, users).name,
  }))

  const documents = [
    { name: 'PNL-rate-card-2026.pdf', category: 'Rate cards', size: '412 KB' },
    { name: 'nigeria-customs-prohibition-list.pdf', category: 'Compliance', size: '188 KB' },
    { name: 'form-m-checklist.docx', category: 'Templates', size: '76 KB' },
    { name: 'corporate-account-agreement.pdf', category: 'Contracts', size: '640 KB' },
    { name: 'packing-and-palletisation-guide.pdf', category: 'Guides', size: '1.2 MB' },
    { name: 'network-coverage-map.png', category: 'Marketing', size: '2.4 MB' },
  ].map((d, i) => ({
    id: 'FIL-' + (i + 1),
    ...d,
    uploadedAt: iso(addH(now, -int(r, 10, 160 * 24))),
    uploadedBy: pick(r, users).name,
    public: i !== 3,
  }))

  /* ── Chatbot configuration (Super Administrator only) ────────────────────── */
  const chatbot = {
    enabled: true,
    name: 'Ada',
    greeting: 'Hello! I can track a consignment, quote a route or connect you to our clearing desk. What do you need?',
    tone: 'professional',
    accent: '#0c2340',
    handoffEmail: 'info@primenextlogistics.com',
    officeHours: '08:00 – 18:00 WAT, Mon–Sat',
    capabilities: {
      tracking: true, quoting: true, faq: true, pickupBooking: false, humanHandoff: true,
    },
    trainingSources: [
      { id: 'TRN-1', label: 'Website FAQs', items: faqs.length, syncedAt: iso(addH(now, -30)) },
      { id: 'TRN-2', label: 'Service pages', items: servicePages.length, syncedAt: iso(addH(now, -30)) },
      { id: 'TRN-3', label: 'Rate card PDF', items: 1, syncedAt: iso(addH(now, -26 * 24)) },
    ],
    stats: { conversations: 1284, resolved: 0.71, handoffs: 372, avgReply: '4s' },
  }

  const settings = {
    company: 'Prime Next Logistics Ltd',
    supportEmail: 'info@primenextlogistics.com',
    phone: '+234 817 364 5360',
    altPhone: '+234 818 348 6038',
    address: '25a Liverpool Road, Apapa, Lagos, Nigeria',
    website: 'www.primenextlogistics.com',
    currency: 'NGN',
    waybillPrefix: 'PNL',
    languages: ['English', 'Nigerian Pidgin', 'Yoruba', 'Igbo', 'Hausa', 'French'],
    emailToggles: {
      customer_registration: true, shipment_creation: true, shipment_update: true,
      delivery_confirmation: true, contact_enquiry: true, quote_request: true, invoice_issued: true,
    },
    podRequireSignature: true,
    podRequirePhoto: false,
  }

  return {
    users, customers, branches, orders, invoices, emails, activity, quotes, enquiries,
    content: { pages: [...sitePages, ...servicePages], blogs, faqs, documents },
    chatbot, settings,
    waybillSeq, invoiceSeq,
  }
}
