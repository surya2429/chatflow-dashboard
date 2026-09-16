# ChatFlow WhatsApp Backend — Cloud API + MM Lite

Unified backend for dispatching WhatsApp messages through two Meta APIs —
**MM Lite** for marketing broadcasts, **Cloud API** for transactional /
authentication / bot-and-agent replies — with a single webhook ingestion
pipeline, 24-hour service-window tracking, and campaign attribution.

## Architecture

```
                         ┌──────────────────────┐
  Marketing Campaign ───▶│   marketingQueue      │───▶ MM Lite API
  (bulk, paced)          │   (BullMQ, rate-limited)     POST /mm_lite
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

3. **Request MM Lite access** — Marketing Messages Lite is currently
   provisioned per WhatsApp Business Account via your Meta account team /
   Partner Solutions rep, or through the in-app WhatsApp Manager prompt
   under **Marketing Messages** if your account is eligible. It does not
   share a permission toggle with the standard Cloud API — confirm access
   before relying on `mm_lite` in production; the code falls back
   gracefully (a `WhatsAppApiError`) if the endpoint isn't enabled for your
   number yet.

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

6. **Approve your templates** — both Cloud API and MM Lite sends require a
   pre-approved message template (WhatsApp Manager → Message Templates).
   MM Lite specifically requires the template's category to be
   **Marketing** — Utility/Authentication templates are not eligible for
   MM Lite dispatch and must go through the standard Cloud API
   (`priorityQueue` / `cloudApiClient`), which this system enforces at the
   application layer via `MessageCategory`.

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
  `MmLiteClient` already accept a `phoneNumberId`/`accessToken` override in
  their constructor — thread the tenant's number through campaign/job data
  instead of relying on the single `env.WA_PHONE_NUMBER_ID` default.
