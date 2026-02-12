# MailDog (MVP)

MailDog is a small, multi-tenant transactional email provider (SendGrid-like core) you can self-host.

**MVP scope**
- Multi-tenant API keys (Bearer)
- Send transactional emails (queued)
- Templates (Mustache render)
- Suppression list + public unsubscribe
- Event ingestion (delivered/bounce/complaint/open/click)
- Outbound event webhooks (best-effort, signed)
- Basic analytics summary endpoint
- Minimal dashboard UI
- Local dev stack: Postgres + Redis (MailHog optional)

> By default, MailDog **does not send real emails**. It uses an adapter interface; for local dev you can use `MAIL_TRANSPORT=noop` or point `smtp_sink` at MailHog if you run it.

## Architecture (high level)

- **apps/api**: Fastify REST API, validates + writes DB rows, enqueues BullMQ jobs
- **apps/worker**: BullMQ worker, renders templates, calls a mail adapter, records events/status
- **apps/dashboard**: Vite + React minimal UI
- **packages/db**: Prisma schema + client
- **packages/shared**: shared DTOs + Zod validators

### Data model (core)
- `Tenant` → has many `ApiKey`, `Template`, `Message`, `Suppression`, `WebhookEndpoint`
- `Message` → one recipient per row for easy analytics
- `MessageEvent` → queued/sent/delivered/bounce/complaint/open/click/unsubscribe

## Local dev

### 1) Prereqs
- Docker Desktop
- Node 22+
- pnpm (install via `npm i -g pnpm`)

### 2) Start infra + services

```bash
cd /Users/aliceguo/src/maildog
cp .env.example .env

# Edit .env and set POSTGRES_PASSWORD + WEBHOOK_SIGNING_SECRET

# first time
# If you don't have pnpm: `npm i -g pnpm`
pnpm install

# start postgres+redis
docker compose up -d

# in two terminals:
set -a && source .env && set +a
pnpm --filter @maildog/api dev

set -a && source .env && set +a
pnpm --filter @maildog/worker dev
```

### 3) Create DB schema

This repo currently uses Prisma without checked-in migrations. For local dev/test, create/update the schema via `db push`:

```bash
cd /Users/aliceguo/src/maildog
export $(cat .env | xargs) # or use direnv
pnpm --filter @maildog/db exec prisma db push
```

### 4) Create a dev tenant + API key

```bash
curl -s -X POST http://localhost:3005/v1/public/dev/seed | jq
```

Copy the returned `apiKey` and:
- Open API docs: http://localhost:3005/docs
- (Optional) Dashboard if you run it: http://localhost:5175
- (Optional) MailHog UI if you run it: http://localhost:8025

### 5) Send a test email

```bash
API_KEY="md_..."
curl -s -X POST http://localhost:3005/v1/mail/send \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"email": "no-reply@maildog.local", "name": "MailDog"},
    "to": [{"email": "test@example.com"}],
    "subject": "Hello from MailDog",
    "text": "If you see this in MailHog, the pipeline works."
  }' | jq
```

Then check MailHog.

## Testing (HTTP contract)

The API package includes Vitest + Supertest contract tests focused on SendGrid-style behavior.

### 1) Start dependencies

```bash
cd /Users/aliceguo/src/maildog
docker compose up -d postgres redis
```

### 2) Ensure schema exists

```bash
cd /Users/aliceguo/src/maildog
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5435/${POSTGRES_DB}"
pnpm --filter @maildog/db exec prisma db push
```

### 3) Run tests

```bash
cd /Users/aliceguo/src/maildog
pnpm test
# or
pnpm --filter @maildog/api test
```

> Tests use the dev seed endpoint (`POST /v1/public/dev/seed`) to create a tenant and API key.

### Docker: running tests

The API Dockerfile includes a `test` target:

```bash
docker build --target test -t maildog-api-test .
docker run --rm --network host \
  -e DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5435/${POSTGRES_DB} \
  -e REDIS_URL=redis://localhost:6381 \
  maildog-api-test
```

## Key API endpoints (MVP)

- `POST /v1/public/dev/seed` (dev-only) → create tenant + api key
- `POST /v1/mail/send` → queue a message (returns **202 Accepted**)
- `POST /v3/mail/send` → SendGrid-compatible alias (same behavior)
- `GET /v1/templates` / `POST /v1/templates` / `PUT /v1/templates/:id`
- `GET /v1/suppressions` / `POST /v1/suppressions` / `DELETE /v1/suppressions/:email`
- `GET /v1/public/unsubscribe?tenantId=...&email=...`
- `POST /v1/events/ingest` → ingest delivered/bounce/complaint/open/click
- `GET /v1/analytics/summary?since=<ISO datetime>`
- `GET /v1/webhooks` / `POST /v1/webhooks` / `PUT /v1/webhooks/:id` / `DELETE /v1/webhooks/:id`

## Webhook signing (MVP)

When a webhook endpoint is configured and an event occurs, MailDog will POST JSON and include:
- `x-maildog-timestamp`: unix seconds
- `x-maildog-signature`: hex HMAC-SHA256 over `<timestamp>.<raw_body>` using `WEBHOOK_SIGNING_SECRET`

## What’s next (recommended)

### Product
- Proper tenant onboarding (users, login) + dashboard auth
- Real template editor + versioning
- Multi-recipient send + per-recipient tracking

### Deliverability / compliance
- Verified sender domains, DKIM/SPF guidance
- List-Unsubscribe headers + signed unsubscribe tokens

### Webhooks (SendGrid style)
- Add retries + DLQ for webhook delivery (BullMQ attempts/backoff)
- Per-tenant signing secrets + endpoint secret rotation
- Idempotency keys for event delivery

### Reliability
- Retry policy + poison queue handling
- Message state machine + failure reasons
- Rate limiting per tenant / api key

### Observability
- Structured logs, metrics, tracing
- Analytics rollups (daily aggregates)

## Notes
This repo is intentionally scaffolded for an MVP. It’s safe-by-default for local development: **MailHog captures SMTP** and no real provider adapters are enabled.
