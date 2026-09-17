# Prime Next Logistics — Management Dashboard

Project 2 from the brief: a secure web-based portal for Prime Next Logistics Ltd (Apapa,
Lagos) to manage customer jobs, consignments and operational workflows. Project 1 (the public
website at primenextlogistics.com) is deliberately **not** included — this repo is the
dashboard only.

It runs as a self-contained React + Vite app that resolves its dependencies from the parent
`node_modules`, so there is no install step.

```bash
npx vite --config pnl-dashboard/vite.config.js --port 5180
```

Then open <http://localhost:5180>. Staff and customers sign in through the same form and land
in the portal that matches their account.

## One number, end to end

A job's id **is** its tracking number. `PNL104413` is issued the moment the request is raised,
and it is the job reference, the number the customer tracks with, and the reference on the
invoice. There is no second identifier to reconcile.

## Three levels of access

| | |
| --- | --- |
| **Customer** | Their own portal: raise a job, order history, notifications, and only the figures that concern them. |
| **Administration User** | Analytics & Reports, Create Order, Order Requests, Quotation Requests, Shipment Tracking, Customer Management, Invoices. |
| **Super Administrator** | All of the above plus user creation, branch and network management, website content, email notification config, AI chatbot config and system settings. |

Administration Users hold an explicit, editable module list; a module they do not hold is
blocked even by direct URL. Customers can never reach an admin route.

### Demo accounts

| Account | Access | Password |
| --- | --- | --- |
| adebayo@primenextlogistics.com | Super Administrator | `admin` |
| chiamaka@primenextlogistics.com | Administration User — all seven sections | `admin` |
| ibrahim@primenextlogistics.com | Administration User — analytics, jobs, tracking | `admin` |
| folasade@primenextlogistics.com | Administration User — analytics, quotations, customers, invoices | `admin` |
| ngozi@lekkiretail.com | Customer portal | `customer` |

## Services and rating

The order form prices the lines the business actually sells, each on its own basis — the
quantity field re-labels itself and the rate follows:

| Service | Charged on | ETA |
| --- | --- | --- |
| Air Freight | chargeable kg | 5 days |
| Ocean Freight (LCL) | CBM | 35 days |
| Ocean Freight (FCL) | containers (TEU) | 32 days |
| 4PL & Door-to-Door | chargeable kg | 12 days |
| Inland Haulage | tonnes | 3 days |
| Customs Clearing | declarations | 7 days |
| Warehousing | pallets per week | 1 day |

Every price is freight + handling + optional cargo insurance + fuel surcharge + **7.5% VAT**,
in whole Naira. Manning (crew management) is a contract service rather than a consignment, so
it lives on the website as a service page and is not bookable as a job here.

## The sections

**Analytics & Reports** — opens on a live operations overview (active consignments, job
requests, completed, cancelled/rejected, exceptions, past ETA, invoiced this month, the
attention queue and the activity feed), with Order, Customer and Shipment report tabs behind
it over a selectable period, each exportable to CSV.

**Create Order** — book a job for a customer at the counter or over the phone. No online
payment, as the brief specifies: payment is a collection method.

**Order Requests** — the decision queue. Confirm or reject incoming requests, then drive each
consignment through its delivery status. Requests raised in the customer portal land here.

**Quotation Requests** — price the rates customers ask for against the live rate card, send
them, and convert an accepted quote straight into a job at the quoted price. Contact-form
enquiries sit behind a tab on the same screen.

**Shipment Tracking** — control-tower view of everything confirmed and moving, with the
milestone history behind each one. Milestones follow a West African forwarding job:
collection, origin handling, the long haul, arrival at port of discharge, Nigeria Customs,
terminal release, then delivery. Purely domestic moves skip the port and Customs steps.

**Customer Management** — registrations, approvals, profiles, and a per-customer trail of
jobs, invoices, activity and notifications.

**Invoices** — generate against any job, preview and print, send, mark paid. The rate engine
that prices a booking is the one that bills it.

**Users & Permissions** *(Super Administrator)* — create staff accounts and assign modules.

**Branches & Network** *(Super Administrator)* — the Lagos port complex the business is built
around (Apapa HQ, Tin Can Island, Lagos Port Complex, MMIA cargo), regional depots (Abuja,
Port Harcourt, Onne, Kano, Ibadan, Onitsha, Warri) and overseas agents (Guangzhou, Dubai,
London, New York, Johannesburg). Active branches are bookable routes on the order forms and
the hub codes stamped on milestones.

**Content Management, Email Notifications, AI Chatbot, System Settings** *(Super
Administrator)* — website pages and the six real service pages, blog, FAQs and documents; the
seven automated notification streams with a delivery log and per-event switches; chatbot
identity, capabilities and knowledge sources; company details, job-number prefix, proof of
delivery requirements and website languages (English, Nigerian Pidgin, Yoruba, Igbo, Hausa,
French).

**Proof of delivery** — recording the `Delivered` milestone captures who signed and whether
photo proof was taken, and emails the customer a delivery confirmation.

Out of scope for this phase, and stated as such in System Settings: the driver/rider mobile
app, in-field signature and photo capture, QuickBooks/Xero integration, and ongoing analytics
monitoring.

## How it works

There is no backend. `src/data/seed.js` builds a deterministic six-month operation — around
415 jobs with their milestones, the quotations, invoices and emails those events fired — from
a fixed PRNG seed, so every run produces the same figures.

`src/store/DataContext.jsx` holds that dataset and every mutation. Each action mutates a deep
clone, appends to the activity trail and queues the customer notification the brief calls for,
then persists to `localStorage`. **Reset demo data** in the user menu or System Settings
restores the original seed.

`src/lib/domain.js` is the single source of truth: services, units and rates, the status
lifecycle and what may follow each status, tracking milestones, the modules each access level
holds, the notification catalogue, and the rate engine.

```
src/
  lib/domain.js        services and units, statuses, milestones, modules, roles, rate engine
  lib/format.js        Naira, dates, unit-aware quantities
  data/seed.js         deterministic six-month dataset
  store/DataContext    state, mutations, notifications, persistence
  store/AuthContext    staff and customer sign-in, module permissions
  components/          UI kit, admin shell, portal shell, tracking timeline, order form
  pages/               one file per admin section
  pages/portal/        the customer portal
```

## Notes

- Amounts are Naira, whole units — change the billing currency in System Settings.
- The dataset lives in the browser, so two people looking at the same deployment each get
  their own copy. Point `DataContext` at a real API to change that.
- **The live site's TLS certificate has expired**, which is why browsers refuse
  `https://www.primenextlogistics.com`. Worth renewing before this dashboard ships alongside
  it — the brief promises SSL as part of hosting.
