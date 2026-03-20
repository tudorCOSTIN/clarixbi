# ClarixBI Security Audit Report

**Date:** 2026-03-20
**Auditor:** Automated Security Scan
**Scope:** Full codebase (`apps/api/src`, `apps/web/src`, configuration files)

---

## Summary

| Category                      | Status  | Issues Found                           |
| ----------------------------- | ------- | -------------------------------------- |
| Console.log in production     | WARNING | 3 instances (seed file only)           |
| Hardcoded secrets             | PASS    | None in production code                |
| SQL injection                 | WARNING | Template literals in SQL (mitigated)   |
| XSS (dangerouslySetInnerHTML) | PASS    | No usage found                         |
| Security headers              | PASS    | Properly configured                    |
| CORS configuration            | WARNING | Hardcoded localhost origin             |
| Cookie security               | PASS    | httpOnly, Secure, SameSite set         |
| Rate limiting                 | PASS    | Global + per-endpoint throttling       |
| .gitignore                    | PASS    | .env files excluded                    |
| npm audit                     | INFO    | Not executed (manual step recommended) |

---

## Detailed Findings

### 1. Console.log in Production Code

**Status:** WARNING

Found `console.log` statements in `apps/api/src/seeds/seed-plans.ts` (lines 85, 88, 92). These are in a seed script, not in runtime application code, so the risk is minimal.

- `apps/api/src/seeds/seed-plans.ts:85` — `console.log(\`Updated plan: ${planData.name}\`)`
- `apps/api/src/seeds/seed-plans.ts:88` — `console.log(\`Created plan: ${planData.name}\`)`
- `apps/api/src/seeds/seed-plans.ts:92` — `console.log('Seed completed successfully.')`

No `console.log` found in `apps/web/src`.

**Remediation:** Replace with the NestJS `Logger` or accept as-is since seed scripts are run manually and not in production runtime.

---

### 2. Hardcoded Secrets / API Keys

**Status:** PASS

- No hardcoded `sk_`, `pk_`, API keys, passwords, or tokens with string literal values found in production code.
- One occurrence of `sk_test_mock` found in a test file (`billing.service.spec.ts`), which is acceptable.
- `.env` is properly listed in `.gitignore`.
- `.env.example` contains placeholder values only (empty strings or clearly-marked dev defaults).

**Note:** The `.env.example` file contains `JWT_SECRET=clarixbi-jwt-secret-dev-change-in-production` and `ENCRYPTION_KEY=0123456789abcdef...` which are clearly marked as dev-only values. Ensure production deployments use unique, securely generated values.

---

### 3. SQL Injection Risks

**Status:** WARNING

Template literal interpolation (`${variable}`) is used in SQL queries in several files. Analysis by file:

**`apps/api/src/modules/widgets/query-builder.service.ts`** (lines 65-156):

- Uses `${table}`, `${aggregation}`, `${metric}`, `${categoryColumn}` in SQL.
- **Mitigated:** This file has a whitelist of allowed tables (line 170) and allowed aggregations (line 195). Values are validated before interpolation.

**`apps/api/src/modules/ai/sql-validator.service.ts`** (line 313, 319, 322):

- Injects `org_id` into SQL WHERE clauses using template literals.
- **Mitigated:** `orgId` comes from the authenticated JWT token, not from user input. The service also validates/sanitizes the entire SQL query.

**`apps/api/src/modules/ai/ai.service.ts`** (lines 277, 285):

- Uses `${table}` and `${orgId}` in ClickHouse queries for schema metadata.
- **Mitigated:** `table` comes from a hardcoded `AVAILABLE_TABLES` constant; `orgId` comes from JWT.

**`apps/api/src/modules/gdpr/gdpr.service.ts`** (line 175):

- Uses `${table}` in DELETE query but uses ClickHouse parameterized binding for `orgId` (`{orgId:String}`).
- **Mitigated:** `table` comes from a hardcoded `CLICKHOUSE_TABLES` constant.

**Remediation:** While current mitigations (whitelists, JWT-sourced values) are effective, consider using parameterized queries consistently (as done in `gdpr.service.ts`) instead of template literal interpolation, even for whitelisted values, as defense in depth.

---

### 4. XSS Risks (dangerouslySetInnerHTML)

**Status:** PASS

No usage of `dangerouslySetInnerHTML` found anywhere in `apps/web/src`. The application uses React's default escaping for all rendered content.

---

### 5. Security Headers

**Status:** PASS

**API (`apps/api/src/main.ts`):**

- Helmet is enabled with a comprehensive configuration.
- Content-Security-Policy: Configured with restrictive directives (`default-src 'self'`, `frame-src 'none'`, `object-src 'none'`).
- HSTS: Enabled with `max-age=31536000` and `includeSubDomains`.
- Permissions-Policy: Restricts camera, microphone, geolocation.
- Referrer-Policy: `strict-origin-when-cross-origin`.

**Frontend (`apps/web/next.config.js`):**

- Security headers applied to all routes via `headers()` config.
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy: Configured (note: includes `'unsafe-eval'` in script-src for Next.js compatibility).
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: Restricts camera, microphone, geolocation.

**Note:** The frontend CSP includes `'unsafe-eval'` in `script-src`, which is commonly required by Next.js in development but should be reviewed for production if possible.

---

### 6. CORS Configuration

**Status:** WARNING

**`apps/api/src/main.ts` (line 52-55):**

```typescript
app.enableCors({
  origin: 'http://localhost:3000',
  credentials: true,
});
```

**`apps/api/src/modules/notifications/notifications.gateway.ts` (line 48-51):**

```typescript
cors: {
  origin: 'http://localhost:3000',
  credentials: true,
}
```

Both CORS configurations are hardcoded to `http://localhost:3000`. This is fine for local development but will need to be updated for production deployment.

**Remediation:** Use an environment variable (e.g., `CORS_ORIGIN` or derive from `NEXT_PUBLIC_APP_URL`) to configure the CORS origin dynamically:

```typescript
app.enableCors({
  origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  credentials: true,
});
```

---

### 7. Cookie Security

**Status:** PASS

Cookie configuration in `apps/api/src/modules/auth/auth.controller.ts`:

| Flag       | Value                                      | Assessment                 |
| ---------- | ------------------------------------------ | -------------------------- |
| `httpOnly` | `true`                                     | Prevents JavaScript access |
| `secure`   | `process.env['NODE_ENV'] === 'production'` | HTTPS-only in production   |
| `sameSite` | `'lax'`                                    | Protects against CSRF      |
| `maxAge`   | Set for both access and refresh tokens     | Proper expiration          |
| `path`     | `'/'`                                      | Appropriate scope          |

Both `access_token` and `refresh_token` cookies follow security best practices.

---

### 8. Rate Limiting

**Status:** PASS

Rate limiting is implemented at multiple levels:

- **Global:** `ThrottlerModule` from `@nestjs/throttler` configured in `app.module.ts` (line 34).
- **Proxy-aware:** Custom `ThrottlerBehindProxyGuard` extracts real client IP.
- **Auth endpoints:** `@Throttle({ default: { limit: 10, ttl: 60000 } })` on login and refresh (10 req/min).
- **Custom decorators:** `AuthThrottle`, `SyncThrottle` (10 req/min), `DemoThrottle` (3 req/hour).
- **AI rate limiting:** Dedicated `AiRateLimitService` with per-org/per-user limits stored in Redis.
- **Connector-level:** SmartBill and WooCommerce connectors have built-in rate limiting.
- **Stripe webhook:** Excluded from rate limiting (appropriate for webhook endpoints).

---

### 9. .gitignore Coverage

**Status:** PASS

The `.gitignore` file properly excludes:

- `.env`, `.env.local`, `.env.*.local` — Environment/secret files
- `node_modules/` — Dependencies
- `dist/`, `build/`, `.next/` — Build artifacts
- `coverage/` — Test coverage reports
- `docker-data/` — Docker volumes
- IDE files (`.idea/`, `.vscode/`)

---

### 10. npm Audit

**Status:** INFO

`npm audit` was not executed as part of this automated scan. It should be run periodically and as part of CI/CD.

**Remediation:** Add `npm audit --audit-level=high` to the CI pipeline and run it before each release.

---

## Additional Observations

### Input Validation

- `ValidationPipe` is globally enabled with `whitelist: true` and `forbidNonWhitelisted: true`, which strips unknown properties and rejects unexpected fields. This is a strong defense against mass assignment attacks.

### Structured Logging

- The API uses `nestjs-pino` for structured logging instead of `console.log`, which is a best practice for production observability.

### Error Monitoring

- Sentry integration is configured with a global filter (`SentryGlobalFilter`) when `SENTRY_DSN` is set.

### Authentication

- JWT strategy extracts tokens from httpOnly cookies (not Authorization header), reducing XSS token theft risk.

---

## Recommendations (Priority Order)

1. **HIGH:** Make CORS origin configurable via environment variable for production deployment.
2. **MEDIUM:** Adopt parameterized queries consistently in ClickHouse interactions (even where values are from trusted sources) as defense in depth.
3. **LOW:** Replace `console.log` in seed script with NestJS Logger for consistency.
4. **LOW:** Review `'unsafe-eval'` in frontend CSP for production; remove if Next.js production build does not require it.
5. **LOW:** Add `npm audit` to CI/CD pipeline.
