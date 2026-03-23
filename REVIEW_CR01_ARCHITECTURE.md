# ClarixBI — Architecture, Backend & Database Review (CR01)

## Overview

- **Date:** 2026-03-23
- **Agents:** Software Architect, Backend Architect, Database Optimizer
- **Pipeline:** Architecture Reviewer (Stage 03)
- **Scope:** Module architecture, API contracts, NestJS patterns, database design
- **Branch:** feat/S06-comprehensive-review

---

## Agent 1: Software Architect Findings

### Module Architecture

| #   | Check                                   | Status        | File                                        | Note                                                        |
| --- | --------------------------------------- | ------------- | ------------------------------------------- | ----------------------------------------------------------- |
| 1   | Single responsibility per module        | ✅            | All 22 modules                              | Each module handles one domain                              |
| 2   | DI used consistently (no `new Service`) | ✅            | All services                                | Zero direct instantiation                                   |
| 3   | Circular dependency: auth ↔ billing     | ⚠️            | `auth.module.ts:33`, `billing.module.ts:19` | `forwardRef` used in both directions                        |
| 4   | ConfigModule loaded twice in AuthModule | ⚠️            | `auth.module.ts:19,22`                      | Duplicated in imports and JwtModule.registerAsync           |
| 5   | Module exports are minimal              | ✅            | All modules                                 | Only necessary providers exported                           |
| 6   | AppModule guards applied globally       | ✅            | `app.module.ts:67-74`                       | ThrottlerBehindProxyGuard + JwtAuthGuard                    |
| 7   | Two controllers in one file (teams)     | ⚠️            | `teams.controller.ts:110-120`               | InviteAcceptController colocated                            |
| 8   | DTOs inline in controller               | ⚠️            | `teams.controller.ts:24-35`                 | InviteDto and ChangeRoleDto in controller file              |
| 9   | Health check completeness               | ❌ → ✅ Fixed | `health.controller.ts`                      | Was only checking Redis; now checks PostgreSQL + ClickHouse |

### API Contract Design

| #   | Check                                | Status | File                       | Note                                                        |
| --- | ------------------------------------ | ------ | -------------------------- | ----------------------------------------------------------- |
| 1   | @ApiOperation on EVERY method        | ❌     | Multiple controllers       | Only 5/20 controllers have @ApiOperation                    |
| 2   | @ApiResponse on ANY method           | ❌     | All controllers            | Zero @ApiResponse decorators in codebase                    |
| 3   | @ApiTags on controllers              | ❌     | 15/20 controllers          | Only 5 controllers have @ApiTags                            |
| 4   | API versioning                       | ✅     | `main.ts:67`               | `app.setGlobalPrefix('api/v1')`                             |
| 5   | Standardized error responses         | ✅     | `http-exception.filter.ts` | GlobalExceptionFilter with consistent format                |
| 6   | Global validation pipe               | ✅     | `main.ts:69-75`            | whitelist + forbidNonWhitelisted + transform                |
| 7   | Consistent response wrapping         | ⚠️     | Multiple                   | Most use `{ data: ... }` but admin/notifications return raw |
| 8   | Swagger disabled in production       | ✅     | `main.ts:77`               | Wrapped in NODE_ENV check                                   |
| 9   | Stripe uses raw fetch instead of SDK | ⚠️     | `billing.service.ts`       | No stripe npm package; uses fetch directly                  |

### Configuration Management

| #   | Check                            | Status        | File                      | Note                                                                      |
| --- | -------------------------------- | ------------- | ------------------------- | ------------------------------------------------------------------------- |
| 1   | Env vars validated at bootstrap  | ✅            | `env.validation.ts`       | Called in main.ts before app creation                                     |
| 2   | Required vars enforced           | ✅            | `env.validation.ts:9-16`  | DATABASE*URL, CLICKHOUSE_URL, REDIS_URL, AUTH0*\*, etc.                   |
| 3   | Production-specific validation   | ✅            | `env.validation.ts:58-72` | JWT_SECRET default check, CORS_ORIGIN required                            |
| 4   | ConfigService usage              | ⚠️            | Multiple                  | 30+ process.env usages outside config/ (8 justified in BullMQ processors) |
| 5   | No localhost fallbacks in config | ✅            | All config files          | All use `!` assertion                                                     |
| 6   | STRIPE_SECRET_KEY not required   | ⚠️            | `env.validation.ts:30`    | Optional, but billing features non-functional without it                  |
| 7   | JWT secret fallback mismatch     | ❌ → ✅ Fixed | `auth.config.ts:11`       | Fallback value now matches env.validation.ts check                        |

### Dependency Analysis

| #   | Check                                          | Status        | File                            | Note                                           |
| --- | ---------------------------------------------- | ------------- | ------------------------------- | ---------------------------------------------- |
| 1   | No duplicate deps between workspaces           | ⚠️            | Root + apps                     | typescript, ts-node, tsconfig-paths duplicated |
| 2   | Critical deps version-locked                   | ❌            | All package.json                | ALL deps use `^` caret ranges                  |
| 3   | @nestjs/schedule and @nestjs/throttler in root | ❌ → ✅ Fixed | `package.json`                  | Moved to apps/api/package.json                 |
| 4   | @types/pdfkit in dependencies                  | ⚠️ → ✅ Fixed | `apps/api/package.json`         | Moved to devDependencies                       |
| 5   | @clarixbi/shared not imported                  | ❌            | All source files                | Zero imports from shared package               |
| 6   | NestJS websocket version mismatch              | ❌ → ✅ Fixed | `apps/api/package.json`         | v11 → v10 to match core NestJS                 |
| 7   | Coverage thresholds set to 0%                  | ❌            | `apps/api/package.json:110-117` | Should be 60/60/55/50 per CLAUDE.md            |
| 8   | jest-environment-jsdom v30 with jest v29       | ⚠️            | `apps/web/package.json:59`      | Major version mismatch                         |

### Monorepo Structure

| #   | Check                                 | Status | File                           | Note                         |
| --- | ------------------------------------- | ------ | ------------------------------ | ---------------------------- |
| 1   | npm workspaces configured             | ✅     | `package.json:5-8`             | Correct: apps/_, packages/_  |
| 2   | Build order correct                   | ✅     | `package.json:13`              | shared → web → api           |
| 3   | Typecheck order correct               | ✅     | `package.json:18`              | shared → web → api           |
| 4   | @clarixbi/shared importable           | ✅     | `packages/shared/package.json` | main + types configured      |
| 5   | tsconfig.base shared                  | ✅     | All tsconfig files             | Both apps extend base        |
| 6   | Next.js transpile packages            | ✅     | `next.config.js:8`             | transpilePackages configured |
| 7   | strictPropertyInitialization disabled | ⚠️     | `apps/api/tsconfig.json:11`    | Weakens TS strictness        |

---

## Agent 2: Backend Architect Findings

### NestJS Patterns

| #   | Check                        | Status        | File                  | Note                                                                                                                         |
| --- | ---------------------------- | ------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Global ValidationPipe        | ✅            | `main.ts:69-75`       | whitelist + forbidNonWhitelisted + transform                                                                                 |
| 2   | Guards applied globally      | ✅            | `app.module.ts:67-74` | ThrottlerBehindProxyGuard + JwtAuthGuard                                                                                     |
| 3   | Logger configured globally   | ✅            | `main.ts:19`          | nestjs-pino                                                                                                                  |
| 4   | Global exception filter      | ✅            | `main.ts:21`          | GlobalExceptionFilter applied                                                                                                |
| 5   | No console.log in production | ✅            | apps/api/src/         | Zero instances found                                                                                                         |
| 6   | Services have Logger         | ❌ → ✅ Fixed | 6 services            | Added Logger to DashboardsService, WidgetsService, SettingsService, NotificationsService, OrganizationsService, TeamsService |

### Error Handling

| #   | Check                                       | Status        | File                                 | Note                                          |
| --- | ------------------------------------------- | ------------- | ------------------------------------ | --------------------------------------------- |
| 1   | Global exception filter catches all         | ✅            | `http-exception.filter.ts`           | @Catch() with no argument                     |
| 2   | Stack traces hidden in production           | ✅            | `http-exception.filter.ts:46-48`     | Returns generic message for non-HttpException |
| 3   | Validation errors return structured details | ✅            | `http-exception.filter.ts:37-41`     | Array messages as details                     |
| 4   | billing.service throws generic Error        | ❌ → ✅ Fixed | `billing.service.ts:166,199`         | Changed to BadGatewayException                |
| 5   | csv.connector throws generic Error          | ❌ → ✅ Fixed | `csv.connector.ts:56`                | Changed to BadRequestException                |
| 6   | Auth0 fetch calls no timeout                | ❌ → ✅ Fixed | `auth.service.ts:49,70,208,227`      | Added AbortSignal.timeout(10000)              |
| 7   | Stripe fetch calls no timeout               | ❌ → ✅ Fixed | `billing.service.ts:154,187,219,708` | Added AbortSignal.timeout(15000)              |

### Authentication & Authorization

| #   | Check                             | Status        | File                      | Note                            |
| --- | --------------------------------- | ------------- | ------------------------- | ------------------------------- |
| 1   | JWT strategy dual extraction      | ✅            | `jwt.strategy.ts:19-23`   | Header + cookie                 |
| 2   | RS256 for Auth0, HS256 for local  | ✅            | `jwt.strategy.ts:25`      | Conditional algorithm           |
| 3   | Refresh token crypto.randomBytes  | ✅            | `auth.service.ts:274`     | No modulo bias                  |
| 4   | Refresh token Redis TTL           | ✅            | `auth.service.ts:146-151` | EX with refreshExpiresIn        |
| 5   | Token rotation on refresh         | ✅            | `auth.service.ts:188-192` | Old deleted, new generated      |
| 6   | RBAC with role hierarchy          | ✅            | `roles.guard.ts:8-13`     | VIEWER < EDITOR < ADMIN < OWNER |
| 7   | Org membership verified           | ✅            | `org-member.guard.ts`     | Checks TeamMember table         |
| 8   | Brute force protection            | ✅            | `brute-force.guard.ts`    | 10 attempts / 15 min            |
| 9   | redis.keys() blocking call        | ❌ → ✅ Fixed | `auth.service.ts:162,196` | Replaced with SCAN              |
| 10  | JWT fallback expiry '1h' mismatch | ❌ → ✅ Fixed | `auth.module.ts:27`       | Changed to '15m'                |
| 11  | Stale comment '30 days'           | ❌ → ✅ Fixed | `auth.controller.ts:88`   | Changed to '7 days'             |
| 12  | JWT secret fallback mismatch      | ❌ → ✅ Fixed | `auth.config.ts:11`       | Aligned with env validation     |

### Middleware & Interceptors

| #   | Check                             | Status | File                           | Note                                              |
| --- | --------------------------------- | ------ | ------------------------------ | ------------------------------------------------- |
| 1   | CORS origin from env              | ✅     | `main.ts:58-65`                | Reads CORS_ORIGIN; localhost fallback in dev only |
| 2   | Rate limiting globally configured | ✅     | `app.module.ts:37-42`          | 100 req / 60s                                     |
| 3   | Auth endpoints stricter limits    | ✅     | `auth.controller.ts`           | 10/min for callback, 5/min for refresh            |
| 4   | Stripe webhooks skip throttling   | ✅     | `stripe-webhook.controller.ts` | @SkipThrottle()                                   |
| 5   | Helmet security headers           | ✅     | `main.ts:27-48`                | CSP, HSTS, etc.                                   |
| 6   | Audit log interceptor             | ✅     | `audit-log.interceptor.ts`     | Non-blocking, no body logging                     |

### External Services Integration

| #   | Check                       | Status        | File                           | Note                                        |
| --- | --------------------------- | ------------- | ------------------------------ | ------------------------------------------- |
| 1   | Auth0 error handling        | ✅            | `auth.service.ts`              | Checks response.ok                          |
| 2   | Auth0 timeout               | ❌ → ✅ Fixed | `auth.service.ts`              | AbortSignal.timeout(10000)                  |
| 3   | Stripe error handling       | ✅            | `billing.service.ts`           | Checks response.ok                          |
| 4   | Stripe timeout              | ❌ → ✅ Fixed | `billing.service.ts`           | AbortSignal.timeout(15000)                  |
| 5   | Stripe webhook verification | ✅            | `stripe-webhook.controller.ts` | HMAC-SHA256 + prod enforcement              |
| 6   | Resend graceful degradation | ✅            | `email.service.ts`             | Skips if no API key                         |
| 7   | Claude AI retry + timeout   | ✅            | `claude-client.service.ts`     | Exponential backoff, 30s timeout            |
| 8   | ClickHouse timeout + pool   | ❌ → ✅ Fixed | `clickhouse.config.ts`         | Added request_timeout, max_open_connections |
| 9   | Redis retry strategy        | ✅            | `redis.config.ts`              | Exponential backoff                         |
| 10  | No localhost fallback       | ✅            | All configs                    | All use process.env['...']!                 |

---

## Agent 3: Database Optimizer Findings

### Entity Design

| #   | Entity           | UUID PK | Created/Updated | DeleteDate | FK Indexes    | Issues                                         |
| --- | ---------------- | ------- | --------------- | ---------- | ------------- | ---------------------------------------------- |
| 1   | Plan             | ✅      | ✅              | N/A        | N/A           | OK                                             |
| 2   | DataSourceEntity | ✅      | ✅              | ✅         | ✅            | OK                                             |
| 3   | Organization     | ✅      | ✅              | ✅         | N/A           | OK                                             |
| 4   | GdprRequest      | ✅      | ✅              | N/A        | ✅            | OK (audit trail)                               |
| 5   | User             | ✅      | ✅              | ✅         | ✅            | OK                                             |
| 6   | AuditLog         | ✅      | ✅ (C only)     | N/A        | ⚠️ → ✅ Fixed | Missing @Index on user_id                      |
| 7   | AIConversation   | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on user_id                      |
| 8   | AIMessage        | ✅      | ✅ (C only)     | N/A        | ⚠️ → ✅ Fixed | Missing @Index on conversation_id              |
| 9   | AlertTrigger     | ✅      | ❌              | N/A        | ⚠️ → ✅ Fixed | Missing @Index on alert_id, acknowledged_by    |
| 10  | Alert            | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on created_by, data_source_id   |
| 11  | Subscription     | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on plan_id                      |
| 12  | DashboardShare   | ✅      | ✅ (C only)     | N/A        | ⚠️ → ✅ Fixed | Missing @Index on dashboard_id, created_by     |
| 13  | Dashboard        | ✅      | ✅              | ✅         | ⚠️ → ✅ Fixed | Missing @Index on created_by                   |
| 14  | Notification     | ✅      | ✅ (C only)     | N/A        | ⚠️ → ✅ Fixed | Missing @Index on user_id                      |
| 15  | ReportSchedule   | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on report_id                    |
| 16  | Report           | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on dashboard_id, created_by     |
| 17  | SyncJob          | ✅      | ✅ (C only)     | N/A        | ⚠️ → ✅ Fixed | Missing @Index on data_source_id               |
| 18  | TeamMember       | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on invited_by                   |
| 19  | Widget           | ✅      | ✅              | ❌         | ⚠️ → ✅ Fixed | Missing @Index on dashboard_id, data_source_id |

### Migration Integrity

| #   | Migration File              | Has up()   | Has down() | Has Indexes | Safety | Issues                                |
| --- | --------------------------- | ---------- | ---------- | ----------- | ------ | ------------------------------------- |
| 1   | InitialSchema               | ✅         | ✅         | Partial     | ❌     | 18 FK indexes missing; No IF EXISTS   |
| 2   | EncryptStripeFields         | ✅ (no-op) | ✅ (no-op) | N/A         | N/A    | Documentation-only                    |
| 3   | AddGdprRequests             | ✅         | ✅         | ✅          | ✅     | Good safety checks                    |
| 4   | AddUserNotificationsEnabled | ✅         | ✅         | N/A         | ✅     | Good safety checks                    |
| 5   | AddMissingFkIndexes (NEW)   | ✅         | ✅         | ✅          | ✅     | Created to add all 18 missing indexes |

### Query Patterns

| #   | Check                          | Status        | File                         | Note                                                |
| --- | ------------------------------ | ------------- | ---------------------------- | --------------------------------------------------- |
| 1   | createQueryBuilder uses params | ✅            | All files                    | Named parameters used correctly                     |
| 2   | find/findOne with org_id       | ✅            | Most services                | Background jobs intentionally query all orgs        |
| 3   | SQL injection in countResource | ❌ → ✅ Fixed | `billing.service.ts:665`     | Replaced string interpolation with static allowlist |
| 4   | N+1 in checkAlerts             | ⚠️            | `alerts.service.ts:190-233`  | Each alert queries trigger individually             |
| 5   | N+1 in handleAlertTriggered    | ⚠️            | `alerts.service.ts:293-328`  | Each member queries user individually               |
| 6   | N+1 in getWidgetData           | ⚠️            | `reports.service.ts:191-206` | Each widget queried individually                    |

### Connection & Pooling

| #   | Check                         | Status        | File                   | Note                                        |
| --- | ----------------------------- | ------------- | ---------------------- | ------------------------------------------- |
| 1   | Connection pooling configured | ❌ → ✅ Fixed | `database.config.ts`   | Added max:30, min:5, idle:30s, connect:5s   |
| 2   | Connection retry logic        | ❌ → ✅ Fixed | `database.config.ts`   | Added retryAttempts:5, retryDelay:3000      |
| 3   | SSL for production            | ❌ → ✅ Fixed | `database.config.ts`   | Added ssl config for production             |
| 4   | synchronize: false            | ✅            | `database.config.ts:9` | Correct                                     |
| 5   | ClickHouse timeout/pool       | ❌ → ✅ Fixed | `clickhouse.config.ts` | Added request_timeout, max_open_connections |

### Performance Patterns

| #   | Check                             | Status        | File                      | Note                                         |
| --- | --------------------------------- | ------------- | ------------------------- | -------------------------------------------- |
| 1   | Pagination on list endpoints      | ⚠️            | Multiple                  | 6 endpoints return unbounded result sets     |
| 2   | Select specific columns           | ⚠️            | All services              | No select: clauses, always SELECT \*         |
| 3   | Eager loading only when necessary | ✅            | All entities              | No eager: true on relations                  |
| 4   | GDPR hard delete transaction      | ❌ → ✅ Fixed | `gdpr.service.ts:153-335` | Wrapped in dataSource.transaction()          |
| 5   | Transactions on multi-step ops    | ⚠️            | Multiple                  | org create, widget bulk update still missing |

---

## Issues Found

### 🔴 Blockers (Must Fix Now) — ALL FIXED

| #   | Issue                                      | Agent     | Fixed                                   |
| --- | ------------------------------------------ | --------- | --------------------------------------- |
| 1   | Health check only checked Redis            | Architect | ✅ Added PostgreSQL + ClickHouse checks |
| 2   | No timeout on Auth0 fetch calls            | Backend   | ✅ AbortSignal.timeout(10000)           |
| 3   | No timeout on Stripe fetch calls           | Backend   | ✅ AbortSignal.timeout(15000)           |
| 4   | billing.service throws generic Error       | Backend   | ✅ BadGatewayException                  |
| 5   | redis.keys() blocking production           | Backend   | ✅ Replaced with SCAN                   |
| 6   | SQL injection in countResource             | Database  | ✅ Static allowlist validation          |
| 7   | GDPR hard delete without transaction       | Database  | ✅ Wrapped in dataSource.transaction()  |
| 8   | No connection pooling configured           | Database  | ✅ max:30, min:5, retry logic           |
| 9   | 18 FK columns missing @Index()             | Database  | ✅ Added decorators + migration         |
| 10  | NestJS websocket version mismatch          | Architect | ✅ v11 → v10                            |
| 11  | @nestjs/schedule/@nestjs/throttler in root | Architect | ✅ Moved to apps/api                    |

### 🟡 Suggestions (Should Fix) — PARTIALLY FIXED

| #   | Issue                                             | Agent     | Status                                     |
| --- | ------------------------------------------------- | --------- | ------------------------------------------ |
| 1   | 6 services missing Logger                         | Backend   | ✅ Fixed                                   |
| 2   | JWT fallback '1h' → '15m'                         | Backend   | ✅ Fixed                                   |
| 3   | JWT secret fallback mismatch                      | Backend   | ✅ Fixed                                   |
| 4   | Stale comment '30 days' → '7 days'                | Backend   | ✅ Fixed                                   |
| 5   | csv.connector generic Error → BadRequestException | Backend   | ✅ Fixed                                   |
| 6   | @types/pdfkit in wrong deps section               | Architect | ✅ Fixed                                   |
| 7   | ClickHouse no timeout/pool config                 | Backend   | ✅ Fixed                                   |
| 8   | @ApiResponse missing everywhere                   | Architect | Deferred (large scope, separate task)      |
| 9   | @clarixbi/shared dead code                        | Architect | Deferred (requires refactoring both apps)  |
| 10  | Coverage thresholds at 0%                         | Architect | Deferred (need coverage improvement first) |
| 11  | Auth↔Billing circular dependency                  | Architect | Noted (functional with forwardRef)         |
| 12  | N+1 query patterns in 3 services                  | Database  | Noted (optimization, separate task)        |
| 13  | Missing pagination on 6 endpoints                 | Database  | Noted (business logic change)              |
| 14  | Missing transactions on 2 more ops                | Database  | Noted (need careful testing)               |

### 💭 Nits (Nice to Have)

| #   | Issue                                   | Agent     | Note                                |
| --- | --------------------------------------- | --------- | ----------------------------------- |
| 1   | DTOs inline in teams controller         | Architect | Minor SRP concern                   |
| 2   | Two controllers in one file (teams)     | Architect | Minor organization                  |
| 3   | `as any` in 4 production code instances | Architect | onboarding demo data + data-sources |
| 4   | All deps use caret ranges (^)           | Architect | Consider pinning critical deps      |
| 5   | strictPropertyInitialization disabled   | Architect | NestJS entities can use `!` instead |
| 6   | Slug generation uses Math.random()      | Backend   | Not security-critical               |
| 7   | Default locale hardcoded to 'ro'        | Backend   | Should come from config             |
| 8   | Missing DeleteDateColumn on 9 entities  | Database  | Need migration + service changes    |

---

## Summary

| Metric               | Value |
| -------------------- | ----- |
| Total checks         | 98    |
| Passed               | 64    |
| Fixed                | 22    |
| Warnings (deferred)  | 12    |
| Total files modified | 33    |

---

## Fixes Applied (2026-03-23)

| #   | Issue                                     | Agent     | What was done                                                                  | File(s)                                             |
| --- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | Health check incomplete                   | Architect | Added PostgreSQL (SELECT 1) + ClickHouse (healthCheck) checks                  | `health.controller.ts`, `health.controller.spec.ts` |
| 2   | Auth0 no timeout                          | Backend   | Added `AbortSignal.timeout(10000)` to 4 fetch calls                            | `auth.service.ts`                                   |
| 3   | Stripe no timeout                         | Backend   | Added `AbortSignal.timeout(15000)` to 4 fetch calls                            | `billing.service.ts`                                |
| 4   | Generic Error → HttpException             | Backend   | `throw new Error(...)` → `throw new BadGatewayException(...)`                  | `billing.service.ts`                                |
| 5   | csv.connector Error → BadRequestException | Backend   | Changed Excel sheet error                                                      | `csv.connector.ts`                                  |
| 6   | redis.keys() → SCAN                       | Backend   | Replaced KEYS with iterative SCAN in refreshAccessToken and revokeRefreshToken | `auth.service.ts`, `auth.service.spec.ts`           |
| 7   | SQL injection in countResource            | Database  | Replaced string interpolation with static RESOURCE_TABLE_MAP allowlist         | `billing.service.ts`                                |
| 8   | GDPR hard delete no transaction           | Database  | Wrapped all PostgreSQL deletes in `dataSource.transaction()`                   | `gdpr.service.ts`                                   |
| 9   | No connection pooling                     | Database  | Added max:30, min:5, idle:30s, connect:5s, retryAttempts:5, SSL                | `database.config.ts`                                |
| 10  | ClickHouse no timeout/pool                | Database  | Added request_timeout:30000, max_open_connections:10, keep_alive               | `clickhouse.config.ts`                              |
| 11  | 18 FK columns missing @Index              | Database  | Added @Index() decorators + new migration                                      | 14 entity files + migration                         |
| 12  | 6 services missing Logger                 | Backend   | Added `private readonly logger = new Logger(...)`                              | 6 service files                                     |
| 13  | JWT fallback '1h' → '15m'                 | Backend   | Aligned fallback with actual config                                            | `auth.module.ts`                                    |
| 14  | JWT secret fallback mismatch              | Backend   | Aligned with env.validation.ts                                                 | `auth.config.ts`                                    |
| 15  | Stale comment '30 days'                   | Backend   | Corrected to '7 days'                                                          | `auth.controller.ts`                                |
| 16  | NestJS websocket v11 → v10                | Architect | Downgraded to match core NestJS                                                | `apps/api/package.json`                             |
| 17  | Root package.json wrong deps              | Architect | Moved @nestjs/schedule, @nestjs/throttler to apps/api                          | `package.json`, `apps/api/package.json`             |
| 18  | @types/pdfkit in wrong section            | Architect | Moved to devDependencies                                                       | `apps/api/package.json`                             |
| 19  | Tests updated                             | All       | Updated health, auth, api-contract, session-persistence tests                  | 4 test files                                        |

## Updated Verdict

**GOOD WITH MINOR FIXES** — Architecture is sound. All blockers resolved. Remaining items are optimizations (pagination, N+1, shared package integration) suitable for future sprints.

## Build Pipeline

- **Lint:** ✅ (0 errors, 0 warnings)
- **Typecheck:** ✅ (clean)
- **Tests:** ✅ (43/43 suites, 727/727 tests passed)
- **Build:** ✅ (web + api success)
