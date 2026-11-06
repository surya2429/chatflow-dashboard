# ChatFlow WhatsApp Backend — Cloud API + Marketing Messages API

Unified backend for dispatching WhatsApp messages through two Meta APIs —
**Marketing Messages API for WhatsApp** for marketing broadcasts, **Cloud API** for transactional /
authentication / bot-and-agent replies — with a single webhook ingestion
pipeline, 24-hour service-window tracking, and campaign attribution.

## Architecture

```
                         ┌──────────────────────┐
  Marketing Campaign ───▶│   marketingQueue      │───▶ Marketing Messages API
  (bulk, paced)          │   (BullMQ, rate-limited)     POST /marketing_messages
                         └──────────────────────┘

  OTP / Transactional  ┌──────────────────────┐
  Bot / Agent reply ──▶│   priorityQueue        │───▶ Cloud API
  (low latency)         │   (BullMQ, high concurrency)  POST /messages
                         └──────────────────────┘

  Meta ──POST /webhook──▶ signature verify ──▶ 200 OK (< 50ms)
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
            statusUpdateQueue        inboundMessageQueue
            (sent/delivered/read/       (text/button/interactive)
             failed)                         │
                    │                        ├─ opt-out/opt-in check
                    ├─ update messages        ├─ open/extend 24h window
                    ├─ bump campaign          ├─ resolve campaign attribution
                    │  counters               └─ hand off to bot/agent
                    └─ mark webhook_events
                       processed
```

Two Node processes, scaled independently:

- **`src/server.ts`** — HTTP only. Webhook ingestion + health checks. Keep
  this fast and stateless; it never touches Meta's send APIs directly.
- **`src/worker.ts`** — all four BullMQ workers. Scale replicas up during a
  large campaign send, down at rest.

## Local setup

```bash
cd backend
cp .env.example .env        # fill in the WA_* values — see "Meta Dashboard" below
npm install

# Postgres + Redis (or point DATABASE_URL / REDIS_URL at existing instances)
docker run -d --name wa-pg -e POSTGRES_USER=chatflow -e POSTGRES_PASSWORD=chatflow \
  -e POSTGRES_DB=chatflow_wa -p 5432:5432 postgres:16
docker run -d --name wa-redis -p 6379:6379 redis:7

npm run migrate             # applies migrations/001_init.sql

npm run dev:api             # terminal 1 — HTTP server on :8080
npm run dev:worker          # terminal 2 — queue workers
```

For Meta to reach your local `/webhook`, tunnel it (e.g. `ngrok http 8080`)
and use the tunnel's HTTPS URL as the Callback URL in the dashboard step
below. Meta requires HTTPS — plain `http://localhost` will not work even
for the verification handshake.

## Environment variables

See [`.env.example`](./.env.example) for the full list with inline
descriptions. The ones that come from Meta specifically:

| Variable | Where to find it |
|---|---|
| `WA_PHONE_NUMBER_ID` | App Dashboard → WhatsApp → API Setup → "From" phone number |
| `WA_BUSINESS_ACCOUNT_ID` | App Dashboard → WhatsApp → API Setup → WhatsApp Business Account ID |
| `WA_ACCESS_TOKEN` | System User token (see step 4 below) — **not** the 24h temporary token shown by default in API Setup |
| `WA_APP_SECRET` | App Dashboard → Settings → Basic → App Secret |
| `WA_WEBHOOK_VERIFY_TOKEN` | You choose this — any long random string, entered identically in the dashboard's webhook config |

## Meta App Dashboard configuration

1. **Create/select the app** — [developers.facebook.com/apps](https://developers.facebook.com/apps) →
   your app → add the **WhatsApp** product if not already added.

2. **Get a phone number & test/production access** — under WhatsApp → API
   Setup, note the `phone_number_id` and `WhatsApp Business Account ID`.
   For production sending you'll need the number verified and the Business
   going through Meta's display-name/business verification.

3. **Onboard to the Marketing Messages API for WhatsApp** — Cloud API is
   [sunsetting marketing messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/overview):
   - **13 Oct 2026** — global announcement.
   - **13 Apr 2027** — accounts created on or after this date can no longer send marketing messages on Cloud API (only on the Marketing Messages API).
   - **13 Oct 2027** — marketing sends on Cloud API fail for everyone.

   To onboard: App Dashboard → WhatsApp → **Quickstart** → the module
   *Improve ROI with marketing messages with optimizations* → **Get started**
   → accept the Terms of Service. You need an active Messaging account in an
   eligible country, an approved **marketing** template and a subscription to
   the `messages` webhook. Existing phone numbers and templates keep working;
   billing is unchanged. Marketing sends go to `POST /{phone_number_id}/marketing_messages`
   (`marketingMessagesClient`). The API is **send-only** and templates-only. By default
   (`product_policy: CLOUD_API_FALLBACK`) a send from an account that is not onboarded yet is
   delivered through Cloud API instead of failing; the delivery status then reports
   `pricing.category = marketing` (not `marketing_lite`) and the message's `channel` is corrected to
   `cloud_api`, so you can see which accounts still need onboarding (`sentViaCloudApi` in the
   engagement report). Set `MM_PRODUCT_POLICY=STRICT` to fail instead.

   Once fully onboarded and verified, you can ask Meta's API to reject marketing
   templates on Cloud API (`disable_marketing_messages_on_cloud_api`), after which a
   marketing template sent to `/messages` fails with error **131063**. The priority
   worker already resends such a template through `/marketing_messages`.
   Status webhooks for these sends report `pricing.category = marketing_lite`.

4. **Create a System User + permanent token** (App Dashboard is a personal
   token by default and expires — do not use it in production):
   - Go to [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)
   - Create a System User with **Admin** role on the Business Account
   - Assign it the WhatsApp Business Account (Assets → Assign)
   - Generate a token with scopes: `whatsapp_business_messaging`,
     `whatsapp_business_management`
   - This is your `WA_ACCESS_TOKEN` — store it in a secrets manager in
     production, never commit it.

5. **Configure the Webhook**:
   - App Dashboard → WhatsApp → Configuration → Webhook
   - **Callback URL**: `https://<your-domain>/webhook`
   - **Verify Token**: the same string as `WA_WEBHOOK_VERIFY_TOKEN` in `.env`
   - Click "Verify and Save" — this triggers the `GET /webhook` handshake
     handled by `handleVerify()` in `src/webhooks/webhookController.ts`
   - **Subscribe to fields**: check `messages` (this single field covers
     both inbound messages and outbound status updates — Meta multiplexes
     both onto `changes[].value.messages[]` / `.statuses[]` under the same
     `field: "messages"` webhook subscription. You do not need to
     separately subscribe to a "message_status" field — it doesn't exist
     as a distinct one in the current API version).

6. **Approve your templates** — both Cloud API and Marketing Messages API
   sends require a pre-approved message template (WhatsApp Manager → Message Templates).
   Marketing templates (category **Marketing**) go through `marketingQueue` /
   `marketingMessagesClient`; Utility, Authentication and service messages go through
   the standard Cloud API (`priorityQueue` / `cloudApiClient`). This system enforces the
   split at the application layer via `MessageCategory`. A Utility template can be
   reclassified as Marketing later (Meta's `template_category_update` webhook): marketing
   templates enqueued on the priority queue are sent via `/marketing_messages` regardless,
   and a 131063 error on `/messages` triggers one resend through it.

7. **App Review** (production only) — `whatsapp_business_messaging` and
   `whatsapp_business_management` need Meta's App Review for anything
   beyond the 5 test numbers available in development mode.

## Database

Migrations live in [`migrations/`](./migrations), run via
[`node-pg-migrate`](https://github.com/salsita/node-pg-migrate) against
raw `.sql` files (`-j sql` in `package.json`'s `migrate` script). See
[`001_init.sql`](./migrations/001_init.sql) for the full schema:
`contacts`, `campaigns`, `messages`, `conversations`, and an append-only
`webhook_events` audit log.
[`003_clients_and_bots.sql`](./migrations/003_clients_and_bots.sql) adds
`clients`, `bots` and the platform-wide `bot_number_seq`.

**The database must be UTF8.** The migration files use box-drawing characters
in their section banners, so applying them to a database created with the
cluster default on a non-UTF8 host (a Windows cluster defaults to WIN1252)
fails with `character with byte sequence 0xe2 0x94 0x80 ... has no equivalent
in encoding "WIN1252"`. Create it explicitly:

```sql
CREATE DATABASE chatflow_wa WITH ENCODING 'UTF8' TEMPLATE template0;
```

### Bot numbering

`bots.bot_number` is the customer-facing id — the one in an install snippet
and a landing page URL. It comes from ONE sequence across the whole platform,
not per client:

```
client 1 -> bot 1 · client 2 -> bot 2 · client 1 -> bot 3 · client 3 -> bot 4
```

Never compute it in application code. `MAX(bot_number) + 1` read by two
concurrent signups gives both the same number and turns the UNIQUE constraint
into a failed signup; the column's `DEFAULT nextval(...)` is the only form
that is correct under concurrency, so inserts omit the column entirely.

The sequence guarantees **unique and increasing**, but not **gapless** —
`nextval()` is non-transactional, so a rolled-back creation burns its number
(verified: a rollback after taking 5 leaves the next insert with 6). That is
the right trade for a bot id; making it gapless requires serializing every
creation in the platform behind one counter row.

## Extending

- **Bot flow / agent desk integration**: `src/services/conversationRouter.ts`
  is the intentional seam — `inboundMessageWorker` calls
  `conversationRouter.handleInbound()` after ingestion (contact upsert,
  opt-out check, session window, attribution) is done. Replace its body
  with a call into your flow engine, or push onto a further `bot-flow`
  queue for a separate consumer.
- **New outbound categories**: extend `MessageCategory` in
  `src/whatsapp/types.ts` and route accordingly in whichever service
  enqueues to `priorityQueue`.
- **Multi-tenant / multiple phone numbers**: `CloudApiClient` /
  `MarketingMessagesClient` already accept a `phoneNumberId`/`accessToken` override in
  their constructor — thread the tenant's number through campaign/job data
  instead of relying on the single `env.WA_PHONE_NUMBER_ID` default.

## Replies, button taps and link clicks (Marketing Messages API)

The Marketing Messages API only **sends**. Everything the customer does afterwards comes back on the normal webhook
for the same phone number, or through a link we control:

| What happened | How we see it | Where it is counted |
|---|---|---|
| Delivered / read | status webhook (`pricing.category = marketing_lite`) | `campaigns.delivered_count`, `read_count` |
| Replied by tapping a quick-reply button, or by replying to the message | `messages` webhook, `context.id` = the campaign message | `replied_count` (once per person), inbound row keeps its `campaign_id`; button taps = `message_type = 'button'` |
| Replied by just typing | `messages` webhook with no context: attributed to the contact's latest marketing message in the last 72 h (`REPLY_ATTRIBUTION_HOURS`) | same |
| Tapped a link button | **our tracked link** (exact, see below) and/or Meta's `marketing_messages_link_click` event | `campaign_link_clicks` |

**Tracked link (exact per-contact clicks).** Meta's click event carries no recipient or message id, and is in limited
availability. For exact clicks, make the template's URL button dynamic: `https://<api-host>/r/{{1}}`, and set the
campaign's `metadata` to `{"trackedLink": {"buttonIndex": 0, "destination": "https://shop.example.com/offer"}}`.
The marketing worker fills `{{1}}` with a signed token for that message; `GET /r/:token` records the click against the
message, campaign and contact, then redirects to `destination` keeping every query parameter Meta added (its `click_id`
must reach the destination). The destination comes only from the campaign settings, never from the request.

**Meta's click event.** Subscribe the app to the `messages` field (already done for statuses). A click event is stored
and tied to a campaign only when exactly one campaign was sent from that number in the last 7 days. When the same
`click_id` also reaches `/r/:token`, the two reports are merged into one row, never counted twice.

**Reading the results:** `GET /api/whatsapp/campaigns/:id/engagement` returns sent / delivered / read / failed, people who replied,
reply messages, button taps, link clicks, unique clickers, rates, and how many messages went through the Marketing
Messages API versus Cloud API. Aggregate figures also exist in Meta's Insights API (`marketing_messages_link_btn_click`
etc., needs `ads_read`); they are not pulled in here.
