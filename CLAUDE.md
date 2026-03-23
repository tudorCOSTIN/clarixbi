# CLAUDE.md — ClarixBI Project Rules & Error Log

> Acest fisier este citit automat de Claude Code la fiecare sesiune.
> Contine reguli obligatorii de coding si un log cu erori intalnite + rezolvari.
> ACTUALIZARE OBLIGATORIE: dupa FIECARE eroare rezolvata, adauga o intrare in ERROR LOG.

---

## PROJECT OVERVIEW

- **Monorepo:** npm workspaces (apps/api, apps/web, packages/shared)
- **Backend:** NestJS 10, TypeORM 0.3, PostgreSQL 15, ClickHouse, Redis, BullMQ
- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Auth:** Auth0 JWT (RS256), httpOnly cookies
- **Payments:** Stripe SDK (subscriptions, webhooks)
- **Email:** Resend SDK
- **AI:** Claude API (Anthropic) — claude-sonnet-4-5-20250514
- **i18n:** next-intl (RO + EN)
- **WebSocket:** Socket.IO (NestJS Gateway)
- **Testing:** Jest 29 + ts-jest
- **CI:** GitHub Actions (lint → typecheck → test → build)

---

## CODING RULES

### General

- TypeScript strict mode ALWAYS — zero `any` in production code (eslint error)
- Unused vars prefixed with `_` (argsIgnorePattern: '^\_')
- Single quotes, semicolons, trailing commas, 100 char line width, 2-space indent, LF line endings
- Run `npm run lint && npm run typecheck` BEFORE declaring anything done
- NEVER use `console.log` in production — use NestJS Logger (backend) or remove (frontend)
- NEVER commit `.env` files, secrets, API keys, or credentials

### Git

- Conventional Commits: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore, perf
- Scope: clarixbi, api, web, shared
- Examples: `feat(api): add alert threshold evaluation`, `fix(web): dashboard loading state`
- Branch naming: `feat/description`, `fix/description`, `refactor/description`
- NEVER push directly to main — always feature branch → PR → merge
- Commitlint enforces max 100 char header

### Git Workflow — Branch Strategy

feature-branch → develop → main

1. Creeaza branch de feature din main: `git checkout -b feat/feature-name`
2. Lucreaza pe feature branch. Commit-uri Conventional Commits.
3. Push feature branch: `git push origin feat/feature-name`
4. Merge in develop: `git checkout develop && git merge feat/feature-name && git push origin develop`
5. Merge in main: `git checkout main && git merge develop && git push origin main`
6. NICIODATA push direct pe main sau develop fara merge din feature branch.

### Git Workflow — Commit & Push Complet

Dupa ce termini ORICE task, urmeaza EXACT aceasta secventa:

```bash
# 1. Commit pe feature branch
cd /Users/mugurel/Documents/clarixbi
git add -A
git commit -m "type(scope): descriere scurta sub 100 chars"

# 2. Push feature branch
git push origin <branch-name>

# 3. Merge in develop
git checkout develop
git merge <branch-name>
git push origin develop

# 4. Merge in main
git checkout main
git merge develop
git push origin main

# 5. Sync repo agentie (FastCoding Agency)
cd /tmp && rm -rf projects-sync
git clone https://github.com/fastcodingagency/projects.git projects-sync
rsync -av --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  /Users/mugurel/Documents/clarixbi/ /tmp/projects-sync/ClarixBI/
cd /tmp/projects-sync
git add ClarixBI/
git commit -m "type(scope): aceeasi descriere ca la commit-ul original"
git push origin main
rm -rf /tmp/projects-sync

# 6. Intoarce-te pe feature branch sau main
cd /Users/mugurel/Documents/clarixbi
git checkout main
```

### Git Workflow — Reguli STRICTE

- NICIODATA nu face push pe main fara merge din develop
- NICIODATA nu face push pe develop fara merge din feature branch
- NICIODATA nu uita sync-ul repo agentie — FIECARE push pe main triggereaza sync
- NICIODATA nu include node_modules, .next, dist, .env in sync
- Daca commit-ul esueaza (pre-commit hook: lint/prettier) → fix problemele, RE-STAGE fisierele, commit NOU (nu --amend)
- Commitlint header max 100 caractere. Detalii in body, nu in titlu.
- Dupa editari, verifica `npm run lint` INAINTE de commit.
- Ruleaza `npx prettier --write <file>` dupa editari lungi, inainte de commit.

### Backend (NestJS)

- Module pattern: module.ts + controller.ts + service.ts + dto/ + entities/
- Every controller method has: @ApiOperation, @ApiResponse decorators
- Every DTO uses class-validator decorators (@IsString, @IsEmail, @IsUUID, etc.)
- Every entity has: @PrimaryGeneratedColumn('uuid'), @CreateDateColumn, @UpdateDateColumn, @DeleteDateColumn (soft delete)
- Every FK column has @Index() decorator AND corresponding migration index
- Service methods handle errors with try/catch — NEVER let unhandled exceptions leak
- Use `this.logger.warn/error()` (NestJS Logger), NEVER console.log
- Environment variables: access via ConfigService or process.env['VAR_NAME'] (bracket notation)
- Redis: NEVER use localhost fallback in processors/services — require REDIS_URL or throw
- Stripe: in production, REQUIRE STRIPE_SECRET_KEY — no mock fallbacks
- Health check: verifica TOATE serviciile critice (PostgreSQL, ClickHouse, Redis), nu doar Redis

### Frontend (Next.js)

- Pages go in: apps/web/src/app/[locale]/(app)/[feature]/page.tsx
- Use 'use client' directive for interactive pages
- Data fetching: use custom hooks from apps/web/src/hooks/ (useDashboards, useDataSources, etc.)
- Hook pattern: useState + useCallback + useEffect + apiClient, return { data, loading, error, refetch }
- NEVER use fetch() directly in pages — use apiClient from @/lib/api-client
- EVERY page must have: loading state (Loader2 spinner), error state (message + retry button), empty state
- EVERY error boundary: create error.tsx alongside page.tsx for critical routes
- i18n: EVERY user-visible string uses useTranslations('namespace') — t('key')
- NEVER hardcode UI strings — use messages/en.json and messages/ro.json
- NEVER use `as any` — find the correct type or create one
- Use next/image instead of <img> tags
- Org context: NEVER use local getOrgId() function — apiClient adds X-Org-Id automatically

### Database

- TypeORM synchronize: false in production (migrations ONLY)
- Every new entity requires a migration file in apps/api/src/migrations/
- Migration format: {timestamp}-{Description}.ts with up() and down() methods
- Every FK column: CREATE INDEX in migration + @Index() on entity
- Connection pooling: configured in database.config.ts (max: 30, min: 5)

### Testing

- Test files: _.spec.ts (co-located) or apps/api/test/_.spec.ts (integration)
- Mock external services: NEVER call real Stripe, Resend, Auth0, ClickHouse in tests
- Mock pattern: jest.mock('module') at top of file, before imports
- Stripe mock: must intercept ALL SDK methods (customers.create, checkout.sessions.create, etc.)
- Global fetch mock: use `global.fetch = jest.fn()` in billing tests to prevent real Stripe API calls
- Coverage thresholds: 60% lines, 60% statements, 55% functions, 50% branches (minimum)
- ALWAYS run `npm run test` after changes and fix failures before committing
- Jest setup: apps/api/test/jest.setup.ts sets REDIS_URL for test environment

### Security

- Auth guard on ALL endpoints except: health, webhooks, shared dashboards, auth callback
- Tenant isolation: EVERY query filters by org_id
- Input validation: global ValidationPipe with whitelist + forbidNonWhitelisted
- Webhook verification: HMAC-SHA256 with timing-safe comparison
- Encryption: AES-256-GCM for credentials and Stripe IDs
- Rate limiting: configured per endpoint category (auth: 10/min, global: 100/min)

---

## COMMON PATTERNS

### New API Endpoint Checklist

1. Create DTO with class-validator decorators
2. Add controller method with @ApiOperation, @ApiResponse, guards
3. Implement service method with error handling
4. Add @Index() on any new FK columns
5. Create migration if new entity/column
6. Write spec.ts with mocked dependencies
7. Run lint + typecheck + test

### New Frontend Page Checklist

1. Create page.tsx with 'use client'
2. Import and use relevant hook (useDashboards, useAlerts, etc.)
3. Add loading state (Loader2 from lucide-react)
4. Add error state with retry button
5. Add empty state with CTA
6. Use useTranslations for ALL strings
7. Add keys to messages/en.json and messages/ro.json
8. Create error.tsx for error boundary
9. Run typecheck + build

### New Hook Checklist

1. File: apps/web/src/hooks/use{Resource}.ts
2. Pattern: useState + useCallback + useEffect + apiClient
3. Return: { data, loading, error, refetch, ...mutations }
4. Export type for the data shape
5. NEVER use fetch() — use apiClient

---

## ERROR LOG

> Format: [DATA] EROARE → CAUZA → FIX
> Adauga o intrare DUPA FIECARE eroare rezolvata.
> Acest log ajuta Claude Code sa NU repete aceleasi greseli.

### [2026-03-21] Stripe tests fail cu "getaddrinfo EAI_AGAIN api.stripe.com"

**Cauza:** jest.mock('stripe') nu intercepta complet SDK-ul. Cand STRIPE_SECRET_KEY era setat in test env, serviciul facea call real la Stripe API.
**Fix:** Mock-ul trebuie plasat INAINTE de import service. Pattern corect:

```typescript
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: { create: jest.fn(), list: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    subscriptions: { update: jest.fn(), retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  }));
});
```

**Regula:** NICIODATA nu permite calls reale la servicii externe in teste.

### [2026-03-21] Redis localhost fallback — jobs pierdute in producție

**Cauza:** 8+ fisiere aveau `process.env['REDIS_URL'] || 'redis://localhost:6379'`. In producție, daca REDIS_URL lipsea, se conecta la localhost (inexistent) → jobs silently failed.
**Fix:** Eliminat fallback localhost. REDIS_URL e required in env.validation.ts, deci fallback e inutil si periculos.
**Regula:** NICIODATA fallback la localhost pentru servicii externe in producție.

### [2026-03-21] Hooks create dar nefolosite in pagini

**Cauza:** Hooks-urile (useDashboards, useAlerts, etc.) au fost create dar paginile continuau sa foloseasca useState + apiClient direct → duplicare cod.
**Fix:** Refactorizat paginile sa importe si foloseasca hooks-urile.
**Regula:** Cand creezi un hook, ACTUALIZEAZA si paginile care il folosesc. Nu lasa dead code.

### [2026-03-21] FK columns fara index → slow queries

**Cauza:** 24 foreign key columns nu aveau @Index() decorator si nici CREATE INDEX in migratii.
**Fix:** Adaugat @Index() pe entitati + migratie noua cu CREATE INDEX IF NOT EXISTS.
**Regula:** FIECARE FK column primeste @Index() PE LOC la creare.

### [2026-03-21] Error boundaries lipsa → white screen of death

**Cauza:** Niciun error.tsx in App Router. Erori nehandle crashau pagina complet fara recovery.
**Fix:** Creat error.tsx in (app)/, dashboards/, alerts/, data-sources/ cu buton "Try Again".
**Regula:** FIECARE route group critica are error.tsx.

### [2026-03-21] "as any" type casts — 12 instante

**Cauza:** router.push() si alte metode aveau parametri castati cu `as any` in loc de tipuri corecte.
**Fix:** Inlocuit cu tipuri corecte sau Route type.
**Regula:** `as any` e INTERZIS. Gaseste tipul corect sau creeaza unul.

### [2026-03-21] getOrgId() duplicat in pagini

**Cauza:** Pagini (reports, alerts) aveau functie locala getOrgId() care citea din localStorage, duplicand logica din apiClient.
**Fix:** Eliminat getOrgId(), lasat apiClient sa gestioneze automat via X-Org-Id header.
**Regula:** O singura sursa de adevar pentru org context — apiClient header.

### [2026-03-22] Build timeout in sandbox/CI

**Cauza:** Next.js build consuma multa memorie. In environments cu RAM limitat → timeout sau OOM.
**Fix:** Asigura NODE_OPTIONS=--max-old-space-size=4096 in CI/build environment.
**Regula:** Seteaza memory limits explicit in CI si deploy configs.

### [2026-03-22] Commitlint header > 100 chars

**Cauza:** Commit message header depasea 100 caractere → commitlint reject in pre-commit hook.
**Fix:** Scurteaza header-ul sub 100 chars, muta detaliile in body.
**Regula:** Header max 100 chars. Detalii in body, nu in titlu.

### [2026-03-22] Prettier formatting breaks lint-staged

**Cauza:** Fisiere generate/editate de agent nu respectau formatarea Prettier → lint-staged le reformata dar diff-ul cauza confuzie.
**Fix:** Ruleaza `npx prettier --write <file>` IMEDIAT dupa crearea/editarea fisierelor cu continut lung.
**Regula:** Dupa editari, verifica `npm run lint` INAINTE de commit.

### [2026-03-23] Health check returning stale data — only Redis status

**Cauza:** HealthController verifica doar Redis. PostgreSQL si ClickHouse puteau fi down fara avertisment.
**Fix:** Extins health check cu PostgreSQL (SELECT 1) si ClickHouse (healthCheck()). Returneaza status per serviciu + overall status (ok/degraded).
**Regula:** Health check-ul trebuie sa verifice TOATE serviciile critice.

### [2026-03-23] localhost:3000 hardcodat in API services

**Cauza:** 7 fisiere API (auth, email, billing, teams, gateway, main, auth.config) aveau fallback la 'http://localhost:3000'. In productie, daca NEXT_PUBLIC_APP_URL lipsea, link-urile din email-uri si redirect-urile mergeau la localhost.
**Fix:** Inlocuit cu `process.env['NEXT_PUBLIC_APP_URL'] || process.env['CORS_ORIGIN']` fara localhost fallback.
**Regula:** NICIODATA localhost ca fallback in cod de producție.

---

## CAND ADAUGI O NOUA INTRARE IN ERROR LOG

Dupa ce rezolvi ORICE eroare, adauga o intrare cu formatul:

```
### [YYYY-MM-DD] Descriere scurta a erorii
**Cauza:** Ce a cauzat eroarea
**Fix:** Cum a fost rezolvata
**Regula:** Ce regula previne repetarea
```
