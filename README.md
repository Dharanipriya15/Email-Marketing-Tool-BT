# BoilerTech Email Marketing

Multi-tenant email marketing app: contacts and CSV import, lists, a rich-text template editor, campaigns (send now or scheduled), reports, signed unsubscribe links, and suppression handling. It sends through Amazon SES (or Brevo).

Stack: Next.js 16 (App Router), TypeScript, Prisma 6, PostgreSQL (Supabase), Vitest.

## Setup

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npx prisma generate
npx prisma migrate deploy   # applies existing migrations; never use migrate reset/dev on a shared DB
npx prisma db seed          # creates the first admin from SEED_ADMIN_* (change the password after first login)
npm run dev                 # http://localhost:3000
```

## Environment variables (names only; see `.env.example` for details)

| Group | Keys |
|---|---|
| Database | `DATABASE_URL` (pooler, 6543), `DIRECT_URL` (session, 5432, used by migrations) |
| Auth | `AUTH_SECRET` |
| Public URL / links | `APP_URL` (https in production), `UNSUBSCRIBE_SECRET` |
| Provider | `EMAIL_PROVIDER` (`ses`/`brevo`), `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_PROVIDER_API_KEY` (Brevo) |
| SES | `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_CONFIGURATION_SET` (optional) |
| Sending safety | `EMAIL_SENDING_ENABLED` (must be `true` to send), `EMAIL_TEST_ALLOWLIST`, `EMAIL_MAX_CAMPAIGN_RECIPIENTS` |
| Throughput | `EMAIL_SEND_RATE_PER_SEC` (keep at or below your SES MaxSendRate; sandbox = 1), `EMAIL_BATCH_SIZE`, `EMAIL_STUCK_SENDING_MINUTES` |
| Background sending | `CRON_SECRET` |
| Bounces/complaints | `AWS_SNS_TOPIC_ARN` (optional allowlist of SNS topics) |
| Seeding | `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` |

Never commit `.env`. `.gitignore` excludes `.env*` except `.env.example`.

## Database migrations

- Use only `npx prisma migrate deploy` against Supabase or production.
- Make schema changes as a new, additive migration, for example generated with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql`. Review it, then run `migrate deploy`.
- Never edit existing migrations. Never run `migrate reset`, and never run `migrate dev` against the shared database.

## How sending works

1. **Send now** (or a scheduled time arriving) snapshots the audience into `CampaignRecipient` rows and moves the campaign to `SENDING`. This step sends nothing.
2. A background dispatcher, `dispatchDueCampaigns`, sends batches at `EMAIL_SEND_RATE_PER_SEC` within a time budget, starts due scheduled campaigns, and completes campaigns. The campaign page auto-refreshes every 5 s. **Send next batch now** remains as a manual nudge.
3. Safety: kill switch, recipient cap, allowlist, suppression re-check before every email, and a guarded `PENDING -> SENDING` claim, so a recipient is never sent twice.
4. Resilience: DB writes around each send retry with exponential backoff on transient connection errors (P1001/P1017, "Server has closed the connection"). Recipients stuck in `SENDING` longer than `EMAIL_STUCK_SENDING_MINUTES` (default 15) are moved to `FAILED` with `lastError` starting "Needs manual review:". They are **never re-sent automatically**, because the provider may already have delivered them.

### Running the dispatcher

- **Vercel:** `vercel.json` calls `/api/cron/dispatch` every minute. Set `CRON_SECRET` in the project; Vercel then sends `Authorization: Bearer <CRON_SECRET>`. Per-minute crons need **Vercel Pro**; Hobby allows only daily crons, so on Hobby use an external scheduler or the worker instead. Each call works for about 45 s, so set the function max duration to 60 s.
- **VPS / local:** `npm run worker` loops the dispatcher continuously (Ctrl+C stops it gracefully). Run it under pm2, systemd, or a similar supervisor. Run only one worker per database. Concurrent runs are still safe because of the per-recipient claim.
- **Manual / external cron:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/dispatch`. Without a valid secret it returns 401; if `CRON_SECRET` is unset, every call returns 401.

## Bounces and complaints (SNS)

`POST /api/webhooks/ses` accepts SNS messages. It verifies the SNS signature (v1/v2, certificate from `sns.<region>.amazonaws.com` only), auto-confirms subscriptions, and on a permanent bounce or a complaint it suppresses the address in the sending organization, marks the contact, and marks the recipient `BOUNCED`. To set it up: create an SNS topic, subscribe `https://<APP_URL>/api/webhooks/ses` (HTTPS), and in SES set the identity's bounce and complaint notifications to that topic, or use a configuration set event destination. Optionally set `AWS_SNS_TOPIC_ARN`.

## Quality checks

```bash
npx tsc --noEmit
npm run lint
npm test            # vitest; providers are mocked, no email is sent
npm run build
npm run smoke       # HTTP smoke test against a running server, logged in as the seed admin
```

## Deployment checklist

- [ ] Hosting: Vercel (Pro for per-minute cron) plus Supabase, or a VPS running `npm run build && npm start` plus `npm run worker` behind HTTPS.
- [ ] `DATABASE_URL`/`DIRECT_URL` point at production. `npx prisma migrate deploy` has run. Seed admin created and password changed.
- [ ] `AUTH_SECRET`, `UNSUBSCRIBE_SECRET`, `CRON_SECRET` set to long random values (`openssl rand -base64 32`).
- [ ] `APP_URL` set to the public https URL (used in unsubscribe links).
- [ ] SES: sending domain verified with **DKIM** (CNAME records in DNS), plus SPF and DMARC records. `EMAIL_FROM_ADDRESS` on that domain.
- [ ] SES **production access** requested (sandbox only sends to verified addresses, 200/day, 1/s). Raise `EMAIL_SEND_RATE_PER_SEC` only up to the granted MaxSendRate.
- [ ] IAM user limited to `ses:SendEmail`.
- [ ] SNS bounce/complaint topic subscribed to `/api/webhooks/ses`.
- [ ] Remove `EMAIL_TEST_ALLOWLIST`, raise `EMAIL_MAX_CAMPAIGN_RECIPIENTS` deliberately, then set `EMAIL_SENDING_ENABLED=true`.
- [ ] Dispatcher running (Vercel cron or worker). Watch for "Needs manual review" recipients.