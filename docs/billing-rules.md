# SmatBot billing rules

The rules the billing system follows, in plain words. The code that applies them is in
`backend/src/billing/` (`service.ts` for customers, `adminApi.ts` for staff, `catalog.ts` for prices);
`backend/scripts/billing.smoke.ts` checks every rule below with real amounts.

All prices are in ₹ and **exclude GST**. GST (18%) is added at checkout: CGST + SGST for customers in
Telangana, IGST for everyone else. Every payment, online or offline, gets a numbered GST invoice.
**No refunds** — this is printed on every invoice and shown before a customer cancels.

## 1. The price list

- Plans and add-ons are edited in the admin console (**Plans & add-ons**). Each edit is a new version
  and is written to the activity log.
- Plans and add-ons are **never deleted**, only **archived**: archived ones can't be newly bought, but
  customers already on them keep them (and can renew them).
- A plan is **public** (on the customer pricing page) or **private** (hidden; staff give it to chosen
  clients — partner and negotiated deals). A customer on a private plan sees it and can renew it.
- **Price changes affect new sales only.** Every customer keeps the prices they bought at (plan and
  add-ons) for as long as their plan stays live — renewals, autopay debits and "renew now" all use the
  locked price. Once a plan lapses, or the customer changes plan, today's list price applies.

## 2. Terms

- Customers buy **monthly** or **yearly**.
- Staff can also give a **custom term of 1–36 months**, priced **monthly price × months** (add-ons
  too). Custom terms never renew automatically.
- Message allowances are per month. A yearly plan or a custom term gets every month's allowance
  credited **upfront as one pool** for the whole term.

## 3. Add-ons

| Kind | Who | Runs | Price |
|---|---|---|---|
| **With the plan** | anyone, at checkout | as long as the plan; renews with it | full rate per period |
| **One-time · 30 days** | any live plan (yearly too) | 30 days — **never past the plan's end** | monthly rate; if the plan ends sooner, only the days it runs (rate × days ÷ 30) |
| **One-time · until the plan ends** | any live plan | to the plan's end | the plan term's rate for the days left (yearly: rate × days ÷ 365) |
| **Recurring (added to the plan)** | card-autopay plans | now, and renews with the plan | now: prorated to the days left; then full rate with every renewal |

- The plan's end date always wins: no add-on runs past it. If the plan is cut short (cancelled now,
  or replaced by a shorter one), its one-time add-ons end with it.
- The same add-on bought twice adds up (quantities are summed).
- Removing a recurring add-on keeps it until the period ends and leaves it out of the next renewal.
- Recurring add-ons are not possible while the next renewal notice has already gone out (try after it
  renews), or if they'd lift the renewal above the ₹15,000 card-autopay limit (buy one-time instead).

## 4. Autopay

- Monthly plans up to ₹15,000 (with GST) use **card autopay**: we save the card under RBI rules, send
  a pre-debit notice 48 hours before each renewal, and debit after it. Above ₹15,000 (yearly plans),
  autopay is a Razorpay Subscription, and the customer's bank asks them to approve each debit.
- **Turning autopay off** never cancels the plan: it keeps working, with its add-ons, until the end
  of the period; then it simply ends. The customer can turn autopay on again any time before that.
- **Changing the card** costs ₹1 (refunded) and is used for every later renewal and recurring add-on.
- A failed renewal starts collection: up to 4 attempts in 9 days, 48–72 hours apart, with a pay-now
  link. The plan keeps working meanwhile; after the window the plan is **suspended**.

## 5. Cancelling

- **At the end of the period**: nothing renews; the plan and its add-ons work until the end date,
  then the plan shows as *cancelled*. The date is shown before confirming.
- **Now**: access ends immediately, along with every add-on. **No refund.** Autopay, the saved card,
  any queued subscription and any open payment link are all stopped.
- Staff can do either from the admin console, with a reason (logged).

## 6. Changing plan

Plans rank by their list price per month; a longer billing period on the same plan also counts as
moving up.

- **Upgrades** (customers, from the dashboard): the new plan **starts today for a full period**, and the
  **unused days of the current plan are credited** — the credit is what they actually paid for the
  current period × (days left ÷ days in the period); a free plan earns no credit. The invoice shows
  the credit as a line. Card autopay carries on at the new plan's price from the new renewal date
  (unless it would pass the ₹15,000 limit, in which case the plan simply ends with its period).
  Upgrading also clears a booked cancellation.
- An upgrade **at the next renewal** is also allowed (autopay): it starts when the current period ends.
- **Downgrades are not possible from the dashboard.** Customers are asked to contact sales. Staff
  make them from the admin console, after the **impact check** (section 8).
- Paying again for the **same** plan while it runs **extends** it from the current end date — no days
  are lost.

## 7. Staff changes (admin console)

- **Change plan**, starting:
  - **now** — replaces the current plan from today;
  - **after the current period** — continues the same plan (a renewal paid offline);
  - **at the next renewal** — card autopay only: the next automatic debit moves to the new plan.
- **Payment**: *free* (no invoice — trials, goodwill, partners' own accounts) or *paid offline* (bank
  transfer, UPI, cheque, cash…): the amount received **including GST**, the method and a reference.
  It is invoiced; a difference from the list price is shown as a price adjustment line.
- If the client is on autopay, staff must confirm that their autopay will be **stopped** before a plan
  starting now is applied — otherwise the customer would be charged twice.
- **Add-ons**: one-time (30 days / until the plan ends / until a date) or recurring; free or offline.
- **Extend** (goodwill): moves the end date later at no charge; card autopay moves its renewal with it.
  Not possible for Razorpay-Subscription autopay (Razorpay's schedule is fixed).
- **Roles**: *Admin* (and the owner) can do everything. *Support* can view everything, add notes and
  open a customer's dashboard — never move money or change who has access.
- Everything staff change is written to the **activity log** with who and when.

## 8. Downgrade impact check

Before a smaller plan is applied, the admin console shows, for **this account**:

- **Features that stop** — and whether the account actually uses them (reported by our services:
  *in use*, *not used*, or *unknown — not reported yet*), with the add-on that would keep them.
- **Features that keep working.**
- **Limits**: allowances on the new plan vs this period's usage — anything already over is flagged.
- **Add-ons** that don't exist on the new plan and will be removed.
- **Actions** to take first (turn something off, add capacity, tell the customer) and that autopay
  will be stopped.

## 9. Usage

- Counts (WhatsApp service / BI messages, OTPs, website chats…) are summed per day (IST) per client;
  gauges (chatbots, live agents, languages) and the features an account uses are reported as a
  snapshot.
- WhatsApp messages are counted automatically when sent, matched to the client by the **sending
  number** — staff enter each client's Meta phone number ID on the client page. Service conversations
  count as service messages, authentication templates as WhatsApp OTPs, everything else as BI.
- Other services report to `POST /api/billing/usage` with the shared `BILLING_USAGE_KEY`:
  `{ events: [{ workspaceId | phoneNumberId, metric, qty, at }], state: [{ workspaceId, counts, features }] }`.
- Usage is compared with the current period's allowance (plan + add-ons). Going over doesn't cut
  anything off automatically — it is shown to the customer and to staff.

## 10. Edge cases

| Situation | Rule |
|---|---|
| The same payment reported twice (webhook + poll + refresh) | Recorded and invoiced once (by payment id). |
| Price changed between checkout and payment | The amount fixed at checkout is the one checked. |
| Upgrade while a renewal debit is being processed | Refused until it completes. |
| Plan change near renewal, notice already sent | Refused until it renews (the notice amount is fixed). |
| Upgrade or add-ons while a payment is overdue | Refused until the overdue payment is made. |
| Coupon on autopay | Not allowed (the customer would authorise a different recurring amount). |
| Coupon on its last use, two payments at once | One may exceed the limit by one (noted in code). |
| Staff gives a plan to an autopay customer | Autopay is stopped only after staff confirm it. |
| A one-time add-on outliving a shorter new plan | Cut to the new plan's end. |
| Cancelled now with a payment link open | The link is cancelled. |
