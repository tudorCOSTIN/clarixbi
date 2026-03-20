# ClarixBI Deployment Guide

This document covers the production deployment of ClarixBI across multiple cloud services.

---

## Architecture Overview

| Service            | Platform         | Domain           | Region         |
| ------------------ | ---------------- | ---------------- | -------------- |
| Frontend (Next.js) | Vercel           | clarixbi.com     | EU (Frankfurt) |
| API (NestJS)       | Railway          | api.clarixbi.com | EU (Frankfurt) |
| PostgreSQL         | Supabase         | —                | EU (Frankfurt) |
| ClickHouse         | ClickHouse Cloud | —                | EU (Frankfurt) |
| Redis              | Upstash          | —                | EU (Frankfurt) |

---

## 1. Frontend — Vercel (apps/web)

### Setup

1. Connect the GitHub repository to Vercel.
2. Set the **Root Directory** to `apps/web`.
3. Set the **Framework Preset** to Next.js.
4. Set the **Build Command** to `cd ../.. && npm run build:web`.
5. Set the **Install Command** to `npm install`.

### Environment Variables

```
NEXT_PUBLIC_APP_URL=https://clarixbi.com
NEXT_PUBLIC_AUTH0_DOMAIN=<auth0-tenant>.eu.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=<auth0-client-id>
NEXT_PUBLIC_AUTH0_AUDIENCE=https://api.clarixbi.com
NEXT_PUBLIC_SENTRY_DSN=<sentry-dsn>
NEXT_PUBLIC_POSTHOG_KEY=<posthog-project-key>
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

### Custom Domain

1. In Vercel project settings, add `clarixbi.com` and `www.clarixbi.com`.
2. Configure DNS records as indicated by Vercel (CNAME or A records).
3. SSL is provisioned automatically by Vercel.

---

## 2. API — Railway (apps/api)

### Setup

1. Create a new Railway project and connect the GitHub repository.
2. Set the **Root Directory** to `apps/api`.
3. Set the **Build Command** to `cd ../.. && npm run build:api`.
4. Set the **Start Command** to `node dist/main.js`.

### Environment Variables

```
NODE_ENV=production

# Database
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require

# ClickHouse
CLICKHOUSE_URL=https://<instance>.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=<clickhouse-password>
CLICKHOUSE_DATABASE=clarixbi_analytics

# Redis
REDIS_URL=rediss://default:<password>@<region>.upstash.io:6379

# Auth0
AUTH0_DOMAIN=<auth0-tenant>.eu.auth0.com
AUTH0_CLIENT_ID=<auth0-client-id>
AUTH0_CLIENT_SECRET=<auth0-client-secret>
AUTH0_AUDIENCE=https://api.clarixbi.com
AUTH0_CALLBACK_URL=https://clarixbi.com/ro/callback
JWT_SECRET=<generate-a-secure-random-string>

# Stripe
STRIPE_SECRET_KEY=sk_live_<key>
STRIPE_PUBLISHABLE_KEY=pk_live_<key>
STRIPE_WEBHOOK_SECRET=whsec_<key>

# Claude API
CLAUDE_API_KEY=<claude-api-key>

# Email
RESEND_API_KEY=<resend-api-key>

# Monitoring
SENTRY_DSN=<sentry-dsn>

# Encryption
ENCRYPTION_KEY=<64-char-hex-string-for-aes-256-gcm>

# CORS (must match frontend URL)
CORS_ORIGIN=https://clarixbi.com

# App
API_URL=https://api.clarixbi.com
NEXT_PUBLIC_APP_URL=https://clarixbi.com
```

### Custom Domain

1. In Railway project settings, add `api.clarixbi.com`.
2. Add the CNAME record provided by Railway to your DNS.
3. Railway provisions SSL automatically.

---

## 3. PostgreSQL — Supabase

### Setup

1. Create a new Supabase project in the EU (Frankfurt) region.
2. Copy the connection string from **Settings > Database**.
3. Use the `postgresql://` connection string with `?sslmode=require`.

### Migrations

Run migrations against the production database:

```bash
DATABASE_URL="<production-connection-string>" npm run migration:run --workspace=apps/api
```

### Backups

Supabase provides automatic daily backups on Pro plan. Point-in-time recovery is available on Team plan and above.

---

## 4. ClickHouse — ClickHouse Cloud

### Setup

1. Create a ClickHouse Cloud service in the EU (Frankfurt) region.
2. Note the HTTPS endpoint (port 8443), username, and password.
3. Create the `clarixbi_analytics` database.

### Tables

The application creates tables automatically on first sync. Verify the following tables exist after initial data sync:

- `invoices`
- `customers`
- `orders`
- `order_items`
- `products`
- `payments`
- `csv_data`

### Performance

- Enable `allow_experimental_lightweight_delete` for GDPR hard deletes.
- Default ClickHouse Cloud scaling handles typical SMB workloads.

---

## 5. Redis — Upstash

### Setup

1. Create an Upstash Redis database in the EU (Frankfurt) region.
2. Enable TLS (default on Upstash).
3. Copy the `rediss://` connection URL (note the double `s` for TLS).

### Usage

Redis is used for:

- Bull queue job management (sync, reports, GDPR)
- AI rate limiting counters
- Session/cache data

---

## 6. DNS Configuration (Cloudflare)

### Records

| Type  | Name  | Value                  | Proxy                 |
| ----- | ----- | ---------------------- | --------------------- |
| CNAME | `@`   | `cname.vercel-dns.com` | DNS only (grey cloud) |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only (grey cloud) |
| CNAME | `api` | `<railway-cname>`      | DNS only (grey cloud) |

**Important:** Set Cloudflare proxy to "DNS only" for domains pointing to Vercel and Railway, as both services handle SSL themselves. Using Cloudflare proxy can cause SSL certificate conflicts.

### Cloudflare Settings

- **SSL/TLS:** Full (strict)
- **Always Use HTTPS:** On
- **Minimum TLS Version:** 1.2
- **HSTS:** Enabled (max-age 31536000, include subdomains)

---

## 7. SSL

- **clarixbi.com:** Auto-provisioned by Vercel (Let's Encrypt).
- **api.clarixbi.com:** Auto-provisioned by Railway (Let's Encrypt).
- **Supabase/ClickHouse/Upstash:** SSL is enabled by default on managed services.

No manual certificate management is required.

---

## 8. Stripe Webhooks

1. In the Stripe Dashboard, create a webhook endpoint: `https://api.clarixbi.com/api/v1/billing/webhook`.
2. Select the following events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
3. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

---

## 9. Auth0 Configuration

1. Create an Auth0 tenant in the EU region.
2. Create a Regular Web Application.
3. Set **Allowed Callback URLs:** `https://clarixbi.com/ro/callback, https://clarixbi.com/en/callback`
4. Set **Allowed Logout URLs:** `https://clarixbi.com`
5. Set **Allowed Web Origins:** `https://clarixbi.com`
6. Create an API with identifier `https://api.clarixbi.com`.

---

## 10. Monitoring

- **Sentry:** Configure `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` for error tracking on both API and frontend.
- **PostHog:** Configure `NEXT_PUBLIC_POSTHOG_KEY` for product analytics (EU instance at `eu.posthog.com`).
- **Better Uptime:** Set up monitors for:
  - `https://clarixbi.com` (frontend health)
  - `https://api.clarixbi.com/api/v1/health` (API health)

---

## Pre-Deployment Checklist

- [ ] All environment variables set in Vercel, Railway
- [ ] Database migrations run against production Supabase
- [ ] ClickHouse Cloud service created and accessible
- [ ] Upstash Redis created and accessible
- [ ] Auth0 tenant configured with correct callback URLs
- [ ] Stripe webhook endpoint created and verified
- [ ] DNS records configured in Cloudflare
- [ ] SSL certificates provisioned (automatic)
- [ ] CORS origin updated to production URL
- [ ] Sentry project created and DSN configured
- [ ] `npm audit` run with no high/critical vulnerabilities
- [ ] Smoke test: login, data sync, dashboard load, AI query
