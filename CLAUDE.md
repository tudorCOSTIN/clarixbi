# CLAUDE.md — Project Rules & Lessons Learned

> This file is read automatically by Claude Code at each session.
> Contains mandatory coding rules and a log of common pitfalls with solutions.
> MANDATORY UPDATE: after EVERY resolved error, add an entry in the ERROR LOG.

---

## PROJECT OVERVIEW

- **Monorepo:** [e.g., npm workspaces, Turborepo, Nx — list workspace paths]
- **Backend:** [e.g., NestJS 10, Express, Fastify] + [ORM] + [DB] + [Cache] + [Queue]
- **Frontend:** [e.g., Next.js 14 App Router, Nuxt, Remix] + [UI lib] + [CSS framework]
- **Auth:** [e.g., Auth0 JWT, Clerk, NextAuth — specify token type]
- **Payments:** [e.g., Stripe SDK — subscriptions, webhooks]
- **Email:** [e.g., Resend, SendGrid, Postmark]
- **AI:** [e.g., Claude API, OpenAI — specify model]
- **i18n:** [e.g., next-intl, react-i18next — list supported locales]
- **WebSocket:** [e.g., Socket.IO, ws — specify gateway pattern]
- **Testing:** [e.g., Jest 29, Vitest — specify runner and setup]
- **E2E:** [e.g., Playwright, Cypress — specify config]
- **CI:** [e.g., GitHub Actions — list pipeline stages]

---

## CODING RULES

### General

- TypeScript strict mode ALWAYS — zero `any` in production code
- Unused vars prefixed with `_` (argsIgnorePattern: `'^_'`)
- Consistent formatting: [quotes, semicolons, trailing commas, line width, indent, line endings]
- Run `npm run lint && npm run typecheck` BEFORE declaring anything done
- NEVER use `console.log` in production — use structured logger (backend) or remove (frontend)
- NEVER commit `.env` files, secrets, API keys, or credentials

### Git

- Conventional Commits: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore, perf, ci, style, revert, build
- Scope: [list your workspace/package names]
- Branch naming: `feat/description`, `fix/description`, `refactor/description`
- NEVER push directly to main — always feature branch → PR → merge
- Commitlint header max 100 characters. Details go in body, not title.
- In commit subject, avoid full-uppercase words (SEO, API, URL). Write lowercase (seo, api, url) — commitlint `subject-case` rejects start-case.
- Review/audit commits → use `chore(scope): description` (not "review" type).
- After edits, run `npx prettier --write <file>` before commit.
- If pre-commit hook fails → fix issues, re-stage files, create NEW commit (never --amend).

### Backend (NestJS / Node.js API)

- Module pattern: module + controller + service + dto/ + entities/
- Every controller method: @ApiOperation, @ApiResponse decorators with status codes (GET: 200, POST: 201, PUT/PATCH: 200, DELETE: 200, all: 401)
- Every DTO: class-validator decorators (@IsString, @IsEmail, @IsUUID, etc.)
- NEVER use `@Body()` with inline types — ALWAYS create a dedicated DTO with class-validator
- Every `@Param()` expecting UUID: add `ParseUUIDPipe`
- Every entity: @PrimaryGeneratedColumn('uuid'), @CreateDateColumn, @UpdateDateColumn, @DeleteDateColumn (soft delete)
- Every FK column: @Index() decorator AND corresponding migration index
- Service methods: try/catch — NEVER let unhandled exceptions leak
- Use structured logger (e.g., NestJS Logger: `this.logger.warn/error()`), NEVER console.log
- Environment variables: access via ConfigService or `process.env['VAR_NAME']` (bracket notation)
- NEVER use localhost fallback for external services (Redis, DB, APIs) — require env var or throw
- NEVER use `forwardRef` for service injection — use string tokens (`@Inject('TOKEN')`) to break circular deps
- Auth guard on ALL endpoints except: health, webhooks, public pages, auth callback
- `OrgMemberGuard` MUST be preceded by `JwtAuthGuard` — authentication comes FIRST
- Swagger/docs endpoints DISABLED in production
- NEVER `Math.random()` for identifiers or tokens — use `crypto.randomBytes()`
- NEVER magic numbers in code — extract named constants
- Webhook verification REQUIRED in production — skip only in dev

### Frontend (Next.js / React)

- Pages: `app/[locale]/(app)/[feature]/page.tsx` with `'use client'` for interactive pages
- Data fetching: use custom hooks (useState + useCallback + useEffect + apiClient)
- NEVER use `fetch()` directly in pages — use apiClient
- When apiClient can't handle response format (blob, FormData), use `fetch()` but ALWAYS include auth/org headers
- EVERY page must have: loading state (spinner), error state (message + retry button), empty state (CTA)
- EVERY route group: create `error.tsx` (error boundary with retry) + `loading.tsx` (streaming/suspense)
- i18n: EVERY user-visible string uses translation hook — ZERO hardcoded strings
- When adding translations, update ALL locale files SIMULTANEOUSLY
- When adding `useTranslations()` to a component, UPDATE tests: wrap with IntlProvider + messages, or mock the i18n module
- NEVER use `as any` — find the correct type or create one
- Use framework's Link component (e.g., `next/link`) — NEVER raw `<a>` tags for internal navigation
- Use framework's Image component (e.g., `next/image`) — NEVER raw `<img>` tags
- Org context: NEVER duplicate org ID logic — let apiClient handle it automatically
- Heavy components (charts, editors, grid layouts > 50KB): lazy load with `dynamic()` / `React.lazy()` + `{ ssr: false }`
- NEVER `console.error` in production frontend — use state-based error display (error state + UI banner/toast)
- Shared constants between components → extract to shared module (single source of truth)

### Accessibility (WCAG 2.1 AA)

- Color contrast: minimum 4.5:1 on ALL backgrounds present in app (not just pure white — check on bg-blue-50, bg-gray-50, bg-white/95 too)
- NEVER use `text-gray-400` or lighter on white/light backgrounds for informational text — minimum `text-gray-500`
- Every modal/dialog: `role="dialog"` + `aria-modal="true"` + `aria-label`
- Every modal: focus trap (e.g., `focus-trap-react`) — mock in tests (jsdom doesn't support tabbable nodes)
- Every icon-only button: `aria-label`
- Every `<label>`: `htmlFor` matching input `id`
- Every input without visible label: `aria-label`
- Every input with error state: `aria-describedby` pointing to error message `id` + `aria-invalid={!!error}`
- Every identity input (email, name, org): `autoComplete` attribute
- Dynamic content — errors: `role="alert" aria-live="assertive"` / status updates: `aria-live="polite"`
- Skip-to-content link as first child in layouts with navigation
- Inline links MUST have permanent `underline` (not just `hover:underline`)

### Database

- ORM synchronize: false in production — migrations ONLY
- Every new entity requires a migration file
- Every FK column: CREATE INDEX in migration + @Index() on entity
- Connection pooling: configure explicitly (don't rely on defaults) — add retry logic and SSL for production
- NEVER string interpolation in SQL (even for table names from switch) — use static allowlist
- Multi-step DELETE/UPDATE operations: ALWAYS wrap in transaction
- NEVER query in a loop (N+1) — use eager loading (`relations`) or batch queries (`In()` operator)
- Every list endpoint: pagination with `findAndCount()` + limit/offset (default: page=1, limit=20)

### Testing

- Test files: `*.spec.ts` (co-located) or `test/*.spec.ts` (integration)
- Mock ALL external services — NEVER call real APIs (Stripe, Auth0, email, etc.) in tests
- Mock pattern: `jest.mock('module')` at top of file, before imports
- Every project with `@testing-library/jest-dom`: jest setup file with global import (`setupFilesAfterEnv`, NOT `setupFilesAfterSetup`)
- Mock missing browser APIs in jsdom (scrollIntoView, IntersectionObserver, matchMedia) in global jest setup
- `focus-trap-react` in tests: mock with `({ children }) => <>{children}</>`
- Mock repos: use intersection type with explicit methods, not just `Record<string, jest.Mock>`
- Coverage thresholds: [set your minimums, e.g., 60% lines, 55% functions]
- Create spec files SIMULTANEOUSLY with new modules — never leave at 0%

### E2E Testing (Playwright)

- If using non-standard test file extensions (e.g., `.e2e.ts`), configure `testMatch` explicitly in playwright config
- Auth mocking: route interception pattern (mock auth cookies + API responses), never real auth calls
- CSP must be environment-aware: allow `'unsafe-eval'` ONLY in development for HMR/source maps, NEVER in production
- After any CSP change, re-run E2E tests

### Security

- Tenant isolation: EVERY query filters by org_id
- Input validation: global ValidationPipe with whitelist + forbidNonWhitelisted
- Webhook verification: HMAC-SHA256 with timing-safe comparison
- Encryption: AES-256-GCM for credentials and sensitive IDs
- Rate limiting: configured per endpoint category
- Access token: max 15 minutes. Refresh token: max 7 days. Cookie maxAge synced with token TTL.
- Refresh token generation: `crypto.randomBytes(32).toString('base64url')` — NEVER modulo on random bytes
- NEVER `redis.keys()` in production — use `redis.scan()` with cursor (KEYS is O(N) and blocks Redis)
- NEVER `unsafe-eval` in CSP in production

### SEO & Public Pages

- Every public layout: export Metadata with title, description, openGraph
- Root layout: `metadataBase`, `title: { template: '%s — AppName' }`, `robots`
- robots.txt: Disallow authenticated routes, Sitemap pointer
- sitemap.xml: generated dynamically or statically for public pages
- 404 and error pages: branded with logo/name, theme colors, helpful message, navigation link
- Favicon in `public/` referenced in layout metadata
- Footer: copyright notice with current year and company name

---

## COMMON PATTERNS

### New API Endpoint Checklist

1. Create DTO with class-validator decorators
2. Add controller method with @ApiOperation, @ApiResponse, guards
3. Implement service method with error handling + try/catch
4. Add @Index() on any new FK columns
5. Create migration if new entity/column
6. Write spec.ts with mocked dependencies
7. Run lint + typecheck + test

### New Frontend Page Checklist

1. Create page.tsx with 'use client'
2. Import and use relevant data hook
3. Add loading state (spinner)
4. Add error state with retry button
5. Add empty state with CTA
6. Use translations for ALL strings — add keys to ALL locale files
7. Create error.tsx for error boundary
8. Create loading.tsx for streaming
9. Run typecheck + build

### New Hook Checklist

1. File: `hooks/use{Resource}.ts`
2. Pattern: useState + useCallback + useEffect + apiClient
3. Return: { data, loading, error, refetch, ...mutations }
4. Export type for the data shape
5. NEVER use fetch() — use apiClient
6. When hook is created, UPDATE pages that should use it — no dead code

### New Modal/Dialog Checklist

1. `role="dialog"` + `aria-modal="true"` + `aria-label`
2. Focus trap wrapper (e.g., FocusTrapDialog)
3. All labels: `htmlFor` + input `id`
4. Close button: `aria-label`
5. Error inputs: `aria-describedby` + `aria-invalid`
6. All strings: translations
7. Mock focus-trap in tests

---

## LESSONS LEARNED (Error Log)

> Format: **Category** — Short description → Rule
> Condensed from real project experience. These prevent repeating common mistakes.

### External Service Mocking in Tests

- **Stripe/API SDK mocks**: Place `jest.mock()` BEFORE importing the service. When API keys exist in test env, the service makes real calls if mock is incomplete.
- **Rule**: NEVER allow real calls to external services in tests. Mock must intercept ALL SDK methods used.
- **Global fetch mock**: Use `global.fetch = jest.fn()` in billing/auth tests to prevent real API calls.

### Redis & External Service Configuration

- **Localhost fallbacks**: Code like `process.env['REDIS_URL'] || 'redis://localhost:6379'` silently fails in production when env var is missing — jobs are lost.
- **Rule**: NEVER fallback to localhost for external services. If env validation guarantees the variable, use `!` assertion.
- **`redis.keys()` in production**: O(N) on entire keyspace, blocks Redis under load. Use `redis.scan()` with cursor instead.

### Database & ORM Pitfalls

- **Missing FK indexes**: Foreign key columns without @Index() cause slow queries at scale. Audit periodically.
- **Missing soft delete columns**: Entities without @DeleteDateColumn() break soft delete. Every main entity needs it.
- **N+1 queries**: Query-in-loop pattern (findOne per item). Use `relations` for eager loading or `In()` for batch.
- **No pagination**: `find()` returning all records. Use `findAndCount()` + take/skip on every list endpoint.
- **No transactions**: Multi-step create/update/delete without transaction leaves orphaned data on failure. Always wrap in `dataSource.transaction()`.
- **SQL injection via interpolation**: Even table names from a switch can be exploited. Use static allowlist + quoted identifiers.
- **Connection pooling defaults**: Default pool (10 connections) causes exhaustion under load. Configure explicitly.

### Authentication & Security

- **JWT token expiry too long**: 1h access + 30d refresh = stolen token valid for hours/days. Use 15min access, 7d refresh.
- **Insecure token generation**: `Math.random().toString(36)` is not cryptographically secure. Use `crypto.randomBytes()`.
- **Modulo bias in random**: `byte % chars.length` reduces entropy. Use `crypto.randomBytes(32).toString('base64url')`.
- **Webhook without verification**: Processing webhooks without signature check in production = security hole.
- **Swagger in production**: Exposes API structure. Disable in production.
- **Auth guard ordering**: OrgMemberGuard without JwtAuthGuard = unauthenticated requests reach business logic.
- **Unvalidated params**: `@Param()` without `ParseUUIDPipe` accepts arbitrary strings for UUID params.
- **Inline `@Body()` types**: No class-validator validation. Always create dedicated DTOs.
- **fetch() without timeout**: External API call without AbortController can block indefinitely. Auth0: 10s, Stripe: 15s.

### Frontend Patterns

- **console.error in production**: Errors logged to console are invisible to users. Use state-based error display with UI banner/toast.
- **Hardcoded strings**: Every UI string must use i18n. After adding translations, update ALL locale files and fix tests.
- **Tests crash after adding i18n**: Components with `useTranslations()` need IntlProvider wrapper or mock in tests.
- **Hooks created but unused**: When creating a hook, update all pages that should use it. Don't leave dead code.
- **`as any` type casts**: Find the correct type instead. Check library types before casting.
- **Raw `<a>` tags**: Cause full page reload. Use framework's Link component.
- **Direct fetch() in pages**: Bypass auth/org headers. Use apiClient (or add headers manually for blob responses).
- **Static imports of heavy libs**: Charts (~400KB), grid layouts (~150KB) loaded in initial bundle. Use dynamic import with `{ ssr: false }`.
- **Duplicate constants**: Same color schemes/configs in multiple files. Extract to shared module.

### Accessibility (WCAG) Issues

- **Low contrast text**: `text-gray-400` on white = 2.9:1 ratio (fails 4.5:1 minimum). Use `text-gray-500`+ on light backgrounds.
- **Primary brand color contrast**: Verify against ALL backgrounds in app (white, blue-50, gray-50, white/95), not just pure white.
- **Missing focus traps**: Keyboard users can tab outside modals. Use focus-trap-react (but mock in jsdom tests).
- **focus-trap + React StrictMode**: `onDeactivate` fires during StrictMode double-mount cycle, closing modals instantly. Guard with `useRef(false)` + `setTimeout(() => ref.current = true, 0)`.
- **Missing ARIA attributes**: Modals without role="dialog", buttons without aria-label, inputs without aria-describedby for errors.
- **Missing aria-live regions**: Dynamic content (notifications, save status, errors) invisible to screen readers.
- **Missing skip-to-content link**: Keyboard users must tab through entire nav on every page.
- **Labels without htmlFor**: Screen readers can't associate labels with inputs.
- **Missing autoComplete**: Browser can't auto-fill identity fields.
- **Inline links without underline**: Links in text blocks indistinguishable from regular text (WCAG violation).

### Next.js Specific

- **Missing error.tsx**: Unhandled errors cause white screen of death with no recovery UI.
- **Missing loading.tsx**: No streaming/suspense — entire page blocks until data fetch completes.
- **CSP blocks dev mode**: `unsafe-eval` needed for HMR/source maps in dev, but NEVER in production. Make CSP environment-aware.
- **Missing favicon**: Browser shows default icon. Add to `public/` and reference in layout metadata.
- **Missing mobile navigation**: Desktop nav overflows on small screens. Add hamburger menu with responsive breakpoints.
- **not-found.tsx needs root layout**: Next.js 14 App Router requires root `app/layout.tsx` if you have `app/not-found.tsx`.
- **nuqs v2 requires NuqsAdapter**: Missing adapter in app layout causes crashes on pages using query state.

### NestJS Specific

- **Package version mismatch**: All @nestjs/\* packages must be on same major version. Verify on every install.
- **Health check incomplete**: Must verify ALL critical services (DB, cache, queue), not just one.
- **Response caching missing**: GET endpoints without CacheInterceptor hit DB on every request. Add with appropriate TTLs.
- **Circular dependencies**: Use string injection tokens instead of forwardRef.

### Git & CI

- **Commitlint uppercase rejection**: Full-uppercase words (SEO, API, URL) in subject trigger `subject-case` rule. Use lowercase.
- **Commitlint invalid type**: "review" is not a standard type. Use "chore" for review/audit commits.
- **Prettier conflicts with lint-staged**: Run `npx prettier --write <file>` immediately after creating/editing files.
- **Build timeout in CI**: Next.js builds need `NODE_OPTIONS=--max-old-space-size=4096` in memory-limited environments.
- **Playwright custom extensions**: Default `testMatch` doesn't find `.e2e.ts` files. Configure explicitly.

### GDPR & Data Operations

- **Hard delete without transaction**: 14+ sequential DELETEs without transaction = orphaned data on failure. Wrap in `dataSource.transaction()`.
- **Rule**: Multi-step destructive operations MUST be transactional.

---

## ADDING NEW ERROR LOG ENTRIES

After resolving ANY error, add an entry following this format:

```
### [YYYY-MM-DD] Short error description
**Cause:** What caused the error
**Fix:** How it was resolved
**Rule:** What rule prevents recurrence
```

Periodically condense entries into the LESSONS LEARNED section above to keep the file manageable.
