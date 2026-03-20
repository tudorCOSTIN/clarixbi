# ClarixBI Runbook

Operational troubleshooting guide for common issues in production.

---

## Table of Contents

1. [Sync Failures](#1-sync-failures)
2. [Stripe Webhook Issues](#2-stripe-webhook-issues)
3. [ClickHouse Slow Queries](#3-clickhouse-slow-queries)
4. [Auth0 Callback Failures](#4-auth0-callback-failures)
5. [Redis Connection Issues](#5-redis-connection-issues)
6. [Database Migration Failures](#6-database-migration-failures)
7. [Build Failures](#7-build-failures)
8. [Monitoring and Alerting](#8-monitoring-and-alerting)

---

## 1. Sync Failures

### SmartBill Rate Limit (HTTP 429)

**Symptoms:** Sync jobs fail with `429 Too Many Requests` from the SmartBill API.

**Cause:** SmartBill enforces API rate limits. The connector has built-in rate limiting (~2400ms between requests) but limits can still be hit during large initial syncs.

**Resolution:**

1. Check the Bull queue for failed jobs in Redis.
2. Failed sync jobs are automatically retried with exponential backoff.
3. If retries are exhausted, trigger a manual re-sync from the data sources settings page.
4. For persistent issues, increase the delay in `smartbill.connector.ts` (`rateLimit()` method).

### SmartBill Credentials Expired

**Symptoms:** Sync fails with `401 Unauthorized`.

**Resolution:**

1. Verify the SmartBill API token in the organization's data source settings.
2. The user must regenerate their API token from the SmartBill portal.
3. Update the encrypted credentials via the data source edit flow.

### WooCommerce Sync Failures

**Symptoms:** WooCommerce sync returns 401 or connection timeouts.

**Resolution:**

1. Verify the store URL, consumer key, and consumer secret.
2. Ensure the WooCommerce REST API is enabled on the store.
3. Check if the store requires HTTPS (consumer keys only work over HTTPS by default).
4. For timeouts, check if the store's hosting provider blocks external API calls.

### ClickHouse Down

**Symptoms:** Sync completes data fetch but fails on insert. Errors mentioning ClickHouse connection refused or timeout.

**Resolution:**

1. Check ClickHouse Cloud status page.
2. Verify `CLICKHOUSE_URL` and credentials in environment variables.
3. Check if the ClickHouse service is paused (ClickHouse Cloud auto-pauses idle services on lower tiers).
4. If paused, any query will wake it up within ~30 seconds; retry the sync.
5. Check network connectivity from Railway to ClickHouse Cloud (IP allowlist if configured).

---

## 2. Stripe Webhook Issues

### Signature Verification Failed

**Symptoms:** Webhook endpoint returns `400 Bad Request`. Logs show `Stripe signature verification failed`.

**Cause:** Mismatch between the webhook signing secret and `STRIPE_WEBHOOK_SECRET` env var.

**Resolution:**

1. Go to Stripe Dashboard > Developers > Webhooks.
2. Click on the webhook endpoint and reveal the signing secret.
3. Compare with `STRIPE_WEBHOOK_SECRET` in Railway env vars.
4. If they don't match, update the env var and redeploy.

### Missing Event Types

**Symptoms:** Subscriptions are created in Stripe but not reflected in the application.

**Resolution:**

1. Verify the webhook is subscribed to the correct events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
2. Check the webhook's "Attempts" tab in Stripe Dashboard for delivery failures.
3. Use Stripe CLI for local testing: `stripe listen --forward-to localhost:4000/api/v1/billing/webhook`

### Webhook Delivery Delays

**Symptoms:** Subscription changes take a long time to appear.

**Resolution:**

1. Stripe retries failed webhooks with increasing delays (up to 72 hours).
2. Check if the API was down during delivery attempts.
3. For immediate resolution, find the event in Stripe Dashboard and click "Resend".

---

## 3. ClickHouse Slow Queries

### General Optimization Tips

1. **Check query logs:**

   ```sql
   SELECT query, query_duration_ms, read_rows, memory_usage
   FROM system.query_log
   WHERE query_duration_ms > 5000
   ORDER BY event_time DESC
   LIMIT 20;
   ```

2. **Ensure `org_id` is in WHERE clause:** All queries should filter by `org_id` first. The SQL validator enforces this for AI queries.

3. **Check table sizes:**

   ```sql
   SELECT table, formatReadableSize(sum(bytes_on_disk)) as size, sum(rows) as total_rows
   FROM system.parts
   WHERE active AND database = 'clarixbi_analytics'
   GROUP BY table;
   ```

4. **Optimize ORDER BY:** Ensure queries ordering large datasets include a LIMIT clause (enforced max 1000 by the query builder).

5. **Partition pruning:** Tables are partitioned by month (`toYYYYMM(created_at)`). Queries with date range filters benefit from partition pruning.

### Dashboard Widgets Slow

**Symptoms:** Dashboard takes more than 5 seconds to load.

**Resolution:**

1. Check if the user's organization has an unusually large dataset.
2. Review widget configurations for missing date range filters.
3. Consider adding materialized views for frequently-used aggregations.

---

## 4. Auth0 Callback Failures

### Redirect URI Mismatch

**Symptoms:** After login, user sees "Callback URL mismatch" error from Auth0.

**Resolution:**

1. In Auth0 Dashboard > Applications > Settings, verify **Allowed Callback URLs** includes:
   - `https://clarixbi.com/ro/callback`
   - `https://clarixbi.com/en/callback`
2. Ensure there are no trailing slashes or protocol mismatches.
3. For staging/preview deployments, add the Vercel preview URL to allowed callbacks.

### Token Expired / Invalid

**Symptoms:** Users are logged out unexpectedly or see "Unauthorized" errors.

**Resolution:**

1. Check if `JWT_SECRET` is consistent across all API instances.
2. Verify Auth0 token expiration settings (default: 24h for access tokens).
3. Check if the refresh token rotation is working — the `/api/v1/auth/refresh` endpoint should issue new tokens.
4. If cookies are not being sent, verify CORS and cookie `sameSite`/`secure` settings.

### Auth0 Service Outage

**Symptoms:** Login page fails to load or redirects hang.

**Resolution:**

1. Check Auth0 status page: https://status.auth0.com
2. Users with existing valid cookies can continue using the app.
3. New logins will be blocked until Auth0 recovers.

---

## 5. Redis Connection Issues

### Connection Refused / Timeout

**Symptoms:** API fails to start or jobs are not processed. Logs show Redis connection errors.

**Resolution:**

1. Verify `REDIS_URL` in environment variables.
2. Check Upstash dashboard for service status.
3. Ensure the connection URL uses `rediss://` (with TLS) for Upstash.
4. Check if the Upstash database has hit its connection limit (free tier: 1000 concurrent).

### Bull Queue Stalled Jobs

**Symptoms:** Sync, report generation, or GDPR deletion jobs are stuck in "active" state.

**Resolution:**

1. Stalled jobs are automatically detected and retried by Bull.
2. If jobs remain stuck, check the Bull queue via Redis:
   ```
   KEYS bull:*:stalled
   ```
3. For persistent issues, restart the API service to reset job consumers.
4. As a last resort, clear the specific queue (data will need to be re-synced):
   ```
   DEL bull:<queue-name>:*
   ```

### Redis Memory Full

**Symptoms:** Write operations fail. Logs show `OOM command not allowed`.

**Resolution:**

1. Check Upstash memory usage in the dashboard.
2. AI rate limit keys expire after 35 days (`RATE_LIMIT_TTL`). Verify keys are expiring.
3. Clear completed Bull job data:
   ```
   Bull queues retain completed jobs. Consider configuring removeOnComplete in job options.
   ```
4. Upgrade the Upstash plan if dataset legitimately exceeds the limit.

---

## 6. Database Migration Failures

### Migration Conflict

**Symptoms:** `npm run migration:run` fails with "relation already exists" or similar.

**Resolution:**

1. Check the `migrations` table in PostgreSQL to see which migrations have run.
2. If a migration partially applied, manually revert the partial changes and re-run.
3. Never edit a migration that has already been applied to production. Create a new migration instead.

### Connection Issues

**Symptoms:** Migration command hangs or fails with connection timeout.

**Resolution:**

1. Verify `DATABASE_URL` includes `?sslmode=require` for Supabase.
2. Check if the database is accessible from your network (Supabase may have IP restrictions).
3. Use the Supabase SQL editor as an alternative to run migration SQL manually.

### Schema Drift

**Symptoms:** Application errors mentioning missing columns or tables.

**Resolution:**

1. Compare the current database schema with the latest migrations.
2. Run pending migrations: `DATABASE_URL="<url>" npm run migration:run --workspace=apps/api`
3. If schema is out of sync, generate a new migration to reconcile.

---

## 7. Build Failures

### Common TypeScript Errors

**`Type 'X' is not assignable to type 'Y'`**

- Check if `@clarixbi/shared` package was built first: `npm run build --workspace=packages/shared`
- The root `npm run build` command builds packages in the correct order.

**`Cannot find module '@clarixbi/shared'`**

- Run `npm install` from the project root to link workspaces.
- Ensure `packages/shared` has been built.

**`Property does not exist on type`**

- Usually caused by a missing or outdated type definition in the shared package.
- Rebuild shared types: `npm run build --workspace=packages/shared`

### Next.js Build Failures

**`Error: Image Optimization`**

- Ensure `next.config.js` has proper image domain configuration if using external images.

**`Module not found` for internal packages**

- Check `transpilePackages` in `next.config.js` includes `@clarixbi/shared`.

### NestJS Build Failures

**Circular dependency warnings**

- NestJS warns about circular module dependencies. Use `forwardRef()` to resolve.
- These are warnings, not errors, but can cause runtime issues if not addressed.

### Out of Memory During Build

**Symptoms:** Build process is killed with `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`.

**Resolution:**

- Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
- On Railway/Vercel, configure this in the build command or environment variables.

---

## 8. Monitoring and Alerting

### Sentry

**Setup:**

- API errors are captured via `SentryGlobalFilter` (enabled when `SENTRY_DSN` is set).
- Frontend errors are captured via `@sentry/nextjs`.

**Key alerts to configure:**

- Error rate spike (> 5% of requests)
- New unhandled exceptions
- Performance degradation (p95 > 3s)

**Dashboard:** https://sentry.io (check the ClarixBI project)

### Better Uptime

**Monitors to configure:**

| Monitor    | URL                                      | Interval | Alert         |
| ---------- | ---------------------------------------- | -------- | ------------- |
| Frontend   | `https://clarixbi.com`                   | 1 min    | Slack + Email |
| API Health | `https://api.clarixbi.com/api/v1/health` | 1 min    | Slack + Email |
| API Docs   | `https://api.clarixbi.com/api/docs`      | 5 min    | Email         |

### PostHog

**Setup:**

- Product analytics on the frontend only.
- EU instance (`eu.posthog.com`) for GDPR compliance.
- Cookie consent is required before PostHog initializes (see `PostHogProvider`).

### Health Checks

The API health endpoint (`/api/v1/health`) should verify:

- PostgreSQL connectivity
- ClickHouse connectivity
- Redis connectivity

If any dependency is down, the health check should return a non-200 status to trigger alerts.

---

## Emergency Contacts

| Service          | Status Page                      | Support             |
| ---------------- | -------------------------------- | ------------------- |
| Vercel           | https://www.vercel-status.com    | support@vercel.com  |
| Railway          | https://status.railway.app       | Discord / support   |
| Supabase         | https://status.supabase.com      | support@supabase.io |
| ClickHouse Cloud | https://status.clickhouse.com    | support portal      |
| Upstash          | https://status.upstash.com       | support@upstash.com |
| Auth0            | https://status.auth0.com         | support portal      |
| Stripe           | https://status.stripe.com        | support portal      |
| Cloudflare       | https://www.cloudflarestatus.com | support portal      |
