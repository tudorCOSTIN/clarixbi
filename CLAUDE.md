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

### [2026-03-23] S06 Security audit — Redis localhost fallback in 13 processor/config files

**Cauza:** Desi REDIS_URL e required in env.validation.ts, 13 fisiere (procesori BullMQ, config, brute-force service) aveau `|| 'redis://localhost:6379'` fallback. env.validation.ts ruleaza la bootstrap, dar config-urile se evalueaza la import time.
**Fix:** Eliminat toate fallback-urile `|| 'redis://localhost:6379'` si `parsed.hostname || 'localhost'` din toate fisierele. Foloseste `process.env['REDIS_URL']!` (non-null assertion) deoarece env validation garanteaza existenta.
**Regula:** NICIODATA fallback la localhost in config/processors. Daca env.validation.ts garanteaza variabila, foloseste `!` assertion.

### [2026-03-23] S06 Security audit — JWT token expiry prea lung (1h access, 30d refresh)

**Cauza:** auth.config.ts avea jwtExpiresIn: '1h' si refreshTokenExpiresIn: 30 zile. Un token furat era valid ore/zile.
**Fix:** Redus la 15 minute (access) si 7 zile (refresh). Actualizat cookie maxAge in auth.controller.ts si expires_in in auth.service.ts.
**Regula:** Access token max 15 minute. Refresh token max 7 zile. Cookie maxAge trebuie sa fie sincronizat cu token TTL.

### [2026-03-23] S06 Security audit — Stripe webhook procesa fara verificare cand secret lipsea

**Cauza:** stripe-webhook.controller.ts doar logga warning daca STRIPE_WEBHOOK_SECRET nu era configurat, apoi procesa webhook-ul oricum.
**Fix:** In productie, returneaza 500 si refuza procesarea. In dev, pastreaza comportamentul anterior (warn + continua).
**Regula:** Webhook verification trebuie sa fie REQUIRED in production. Mock/skip doar in dev.

### [2026-03-23] S06 Security audit — unsafe-eval in frontend CSP

**Cauza:** next.config.js avea `'unsafe-eval'` in script-src CSP, permitand eval-based XSS.
**Fix:** Eliminat `'unsafe-eval'` din CSP. Build-ul Next.js functioneaza fara el.
**Regula:** NICIODATA unsafe-eval in CSP. Testeaza build-ul dupa orice modificare CSP.

### [2026-03-23] S06 Security audit — refresh token generare cu modulo bias

**Cauza:** auth.service.ts genera refresh tokens cu `byte % chars.length` care introduce modulo bias (reduce entropia).
**Fix:** Inlocuit cu `crypto.randomBytes(32).toString('base64url')` — generare unbiased, 256 bits entropy.
**Regula:** Foloseste crypto.randomBytes() pentru token generation. NICIODATA modulo pe random bytes.

### [2026-03-23] S06 Security audit — Swagger docs expuse in production

**Cauza:** SwaggerModule.setup() rula indiferent de environment, expunand structura API-ului in productie.
**Fix:** Wrapped in `if (NODE_ENV !== 'production')` check.
**Regula:** Swagger/docs endpoints DEZACTIVATE in production.

### [2026-03-23] S06 SEO — Pagini publice fara meta tags (title, description, OG)

**Cauza:** Layout-urile `(auth)/layout.tsx` si `legal/layout.tsx` nu exportau `metadata`. Paginile de login, signup, legal nu aveau title, description, sau Open Graph tags → SEO slab, social sharing fara preview.
**Fix:** Adaugat `export const metadata: Metadata` cu title, description, openGraph in fiecare layout public. Root `[locale]/layout.tsx` extins cu `metadataBase`, `title.template`, `robots`.
**Regula:** FIECARE layout public trebuie sa exporte Metadata cu cel putin: title, description, openGraph. Foloseste `title: { template: '%s — ClarixBI' }` in root layout.

### [2026-03-23] S06 SEO — robots.txt si sitemap.xml lipsa

**Cauza:** Nu existau `public/robots.txt` si `app/sitemap.ts`. Motoarele de cautare nu stiau ce sa indexeze si ce sa ignore.
**Fix:** Creat `robots.txt` cu Disallow pe toate rutele autentificate (/en/dashboards/, /ro/alerts/, etc.) si Sitemap pointer. Creat `app/sitemap.ts` cu `MetadataRoute.Sitemap` pentru paginile publice.
**Regula:** Orice aplicatie web publica TREBUIE sa aiba robots.txt (cu Disallow pe rutele private) si sitemap.xml (generat dinamic sau static).

### [2026-03-23] S06 SEO — not-found.tsx lipsa → 404 default fara branding

**Cauza:** Nu exista `app/not-found.tsx`. Next.js afisa pagina 404 default fara branding sau link de navigare.
**Fix:** Creat `app/not-found.tsx` cu HTML wrapper (`<html><body>`) si link "Go Home". Creat `app/layout.tsx` minimal (passthrough) necesar de Next.js 14 pentru not-found.tsx la nivel root.
**Regula:** Next.js 14 App Router necesita `app/layout.tsx` root daca ai `app/not-found.tsx`. Layout-ul root trebuie sa fie passthrough (`return children`) cand ai deja `[locale]/layout.tsx`.

### [2026-03-23] S06 SEO — 42+ string-uri hardcodate in componente (fara i18n)

**Cauza:** Componente si pagini (ShareModal, WidgetConfigurator, dashboard view, callback, alerts, reports) aveau string-uri in romana/engleza hardcodate direct in JSX, fara `useTranslations()`.
**Fix:** Inlocuit toate string-urile cu `useTranslations('namespace')` — `t('key')`. Adaugat cheile in `messages/en.json` si `messages/ro.json`. Namespace-uri noi: `dashboard.view`, `dashboard.shareModal`, `widget`, `a11y`, `shared`.
**Regula:** ZERO string-uri hardcodate in UI. FIECARE text vizibil utilizatorului foloseste `useTranslations()`. La fiecare componenta noua, adauga cheile in AMBELE fisiere de mesaje (en.json + ro.json) SIMULTAN.

### [2026-03-23] S06 SEO — aria-label si role="dialog" lipsa pe modale si butoane icon-only

**Cauza:** Modale (ShareModal, WidgetConfigurator, CreateAlertWizard, AlertHistoryModal, CreateReportModal, ScheduleModal) nu aveau `role="dialog"`, `aria-modal="true"`, `aria-label`. Butoane icon-only (clone, edit, delete, close) nu aveau `aria-label` → screen readers nu puteau identifica actiunea.
**Fix:** Adaugat `role="dialog"` + `aria-modal="true"` + `aria-label` pe fiecare modal overlay. Adaugat `aria-label` pe FIECARE buton icon-only. Creat namespace `a11y` in messages pentru label-uri reutilizabile (close, copyLink, deleteItem, editItem).
**Regula:** FIECARE modal: `role="dialog"` + `aria-modal="true"` + `aria-label`. FIECARE buton fara text vizibil: `aria-label` descriptiv. Foloseste namespace `a11y` din i18n pentru label-uri comune.

### [2026-03-23] S06 SEO — Teste frontend crapa dupa adaugare useTranslations()

**Cauza:** Dupa inlocuirea string-urilor hardcodate cu `useTranslations()`, testele (WidgetConfigurator.test.tsx, DashboardGrid.test.tsx) crashau cu "context from NextIntlClientProvider was not found".
**Fix:** In teste, wrapeaza renderul cu `NextIntlClientProvider` si furnizeaza un obiect `messages` minimal cu cheile necesare. Alternativ, mock-uieste `next-intl` cu `jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))`.
**Regula:** Cand adaugi `useTranslations()` intr-o componenta, ACTUALIZEAZA si testele: fie wrapeaza cu `NextIntlClientProvider` + messages, fie mock-uieste `next-intl`. Verifica testele IMEDIAT dupa i18n changes.

### [2026-03-23] Commitlint rejecta "SEO" in subject — start-case detection

**Cauza:** Commit message `fix(web): S06 SEO fixes — meta, robots, sitemap, a11y, i18n` era rejectat de commitlint. Cuvantul "SEO" (toate majuscule) triggera regula `subject-case` care interzice start-case/sentence-case/pascal-case/upper-case.
**Fix:** Reformulat: `fix(web): resolve S06 seo issues across frontend` (lowercase "seo").
**Regula:** In commit subject, evita cuvinte full-uppercase (SEO, API, URL, etc.). Scrie-le lowercase (seo, api, url) sau reformuleaza. Commitlint `subject-case` nu permite start-case.

### [2026-03-23] CR01 — Health check inca verifica doar Redis (regresie)

**Cauza:** Health check-ul din error log-ul anterior nu a fost implementat complet. HealthController inca verifica doar Redis ping, fara PostgreSQL si ClickHouse.
**Fix:** Adaugat DataSource injection (SELECT 1 pentru PostgreSQL) si ClickHouseService injection (healthCheck()) in HealthController. Returneaza status per serviciu + overall 'ok'/'degraded'.
**Regula:** Dupa ce notezi un fix in error log, VERIFICA ca fix-ul e realmente implementat in cod. Health check-ul trebuie sa verifice TOATE serviciile critice.

### [2026-03-23] CR01 — Auth0 si Stripe fetch() fara timeout

**Cauza:** auth.service.ts avea 4 fetch() calls la Auth0 si billing.service.ts avea 4 fetch() calls la Stripe fara AbortController/timeout. Un raspuns intarziat putea bloca request-ul indefinit.
**Fix:** Adaugat `signal: AbortSignal.timeout(10000)` pe Auth0 calls si `signal: AbortSignal.timeout(15000)` pe Stripe calls.
**Regula:** FIECARE fetch() call extern TREBUIE sa aiba timeout. Foloseste `AbortSignal.timeout(ms)` sau `AbortController`. Auth0: 10s, Stripe: 15s, general: 30s.

### [2026-03-23] CR01 — redis.keys() blocheaza Redis in productie

**Cauza:** auth.service.ts folosea `redis.keys()` (O(N) pe intreg keyspace-ul Redis) in refreshAccessToken si revokeRefreshToken. Cu multi utilizatori, comanda KEYS blocheaza Redis-ul.
**Fix:** Inlocuit cu `redis.scan()` iterativ (non-blocking, cursor-based). SCAN proceseaza in batch-uri de 100.
**Regula:** NICIODATA `redis.keys()` in cod de productie. Foloseste `redis.scan()` cu cursor. KEYS e acceptabil doar in dev/debug.

### [2026-03-23] CR01 — SQL injection potential in billing.service.ts countResource

**Cauza:** `countResource()` interpola numele tabelei in SQL query via string (`${table}`). Desi valoarea venea dintr-un switch, parametrul `resource` provine din input extern.
**Fix:** Creat `RESOURCE_TABLE_MAP` static (allowlist) si validare stricta: daca resursa nu e in map, returneaza 0. Tabelul e acum quoted cu `"table"`.
**Regula:** NICIODATA string interpolation in SQL, chiar daca valoarea pare controlata. Foloseste un allowlist static pentru table/column names.

### [2026-03-23] CR01 — GDPR hard delete fara tranzactie (14+ operatii secventiale)

**Cauza:** `gdpr.service.ts executeHardDelete()` facea 14+ DELETE-uri secventiale fara tranzactie. O eroare la mijloc lasa date orfane, incalcand GDPR compliance.
**Fix:** Wrapped toate DELETE-urile PostgreSQL in `dataSource.transaction()`. ClickHouse deletes raman in afara tranzactiei (DB separat).
**Regula:** Operatii multi-step de DELETE/UPDATE TREBUIE wrappate in tranzactie. Foloseste `dataSource.transaction(async (manager) => {...})`.

### [2026-03-23] CR02 — console.error in frontend production code (7 instante)

**Cauza:** `dashboards/page.tsx` si `dashboards/[id]/edit/page.tsx` aveau 7 `console.error()` calls in catch blocks, plus `/* eslint-disable no-console */` la nivel de fisier. Erorile din handleDelete, handleClone, autoSave, addWidget, removeWidget, updateWidget se pierdeau in consola.
**Fix:** Inlocuit `console.error` cu state-based error display (`actionError`/`editError` state). Adaugat error banner UI cu buton de dismiss. Eliminat `/* eslint-disable no-console */`.
**Regula:** NICIODATA `console.error` in frontend production code. Foloseste state-based error display (error state + UI banner/toast). Daca eroarea trebuie logata, foloseste un logging service, nu console.

### [2026-03-23] CR02 — string-uri hardcodate in dashboard edit page (7 instante)

**Cauza:** `dashboards/[id]/edit/page.tsx` avea 7 string-uri in engleza hardcodate direct in JSX: "Back", "Saving...", "Saved", "Edit", "Preview", "No widgets yet", "Click or drag a widget from the library to get started".
**Fix:** Adaugat `useTranslations('dashboardEdit')` hook. Creat namespace `dashboardEdit` in `messages/en.json` si `messages/ro.json` cu 15 chei (inclusiv error messages).
**Regula:** ZERO string-uri hardcodate in UI. FIECARE text vizibil utilizatorului foloseste `useTranslations()`. Cand adaugi o pagina noua, creeaza namespace-ul i18n SIMULTAN.

### [2026-03-23] CR01 — Database connection pooling neconfigurat

**Cauza:** database.config.ts folosea default-urile TypeORM (max 10 conexiuni). Sub load, cauzeaza connection exhaustion. CLAUDE.md specifica max:30, min:5 dar nu era implementat.
**Fix:** Adaugat `extra: { max: 30, min: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }`, `retryAttempts: 5`, `retryDelay: 3000`, si SSL config pentru productie.
**Regula:** INTOTDEAUNA configureaza connection pooling explicit. Nu te baza pe default-uri. Adauga retry logic si SSL pentru productie.

### [2026-03-23] CR01 — 18 FK columns fara @Index() (regresie partiala)

**Cauza:** Desi error log-ul anterior documenta adaugarea @Index() pe FK columns, 18 coloane ramasesera fara index. Entitati afectate: AuditLog, AIConversation, AIMessage, AlertTrigger, Alert, Subscription, DashboardShare, Dashboard, Notification, ReportSchedule, Report, SyncJob, TeamMember, Widget.
**Fix:** Adaugat @Index() pe FIECARE FK column identificat. Creat migratie `1774329600000-AddMissingFkIndexes.ts` cu CREATE INDEX IF NOT EXISTS.
**Regula:** La FIECARE adaugare de FK column, verifica cu grep ca @Index() e prezent. Ruleaza un audit periodic: `grep -r 'ManyToOne\|@Column.*_id' | grep -v '@Index'`.

### [2026-03-23] CR01 — NestJS websocket packages v11 cu core v10

**Cauza:** @nestjs/platform-socket.io si @nestjs/websockets erau v11 (^11.1.17) in timp ce @nestjs/core era v10 (^10.3.0). Major version mismatch poate cauza runtime incompatibilitati.
**Fix:** Downgradeat la ^10.3.0 pentru a se alinia cu core NestJS.
**Regula:** TOATE pachetele @nestjs/\* trebuie sa fie pe aceeasi versiune major. Verifica la fiecare npm install.

---

## CAND ADAUGI O NOUA INTRARE IN ERROR LOG

Dupa ce rezolvi ORICE eroare, adauga o intrare cu formatul:

```
### [YYYY-MM-DD] Descriere scurta a erorii
**Cauza:** Ce a cauzat eroarea
**Fix:** Cum a fost rezolvata
**Regula:** Ce regula previne repetarea
```

### [2026-03-23] CR03 — Missing error.tsx boundaries in all (app) routes

**Cauza:** Niciun error.tsx in route groups critice. Erori nehandle puteau cauza white screen of death fara recovery UI.
**Fix:** Creat error.tsx in: `(app)/`, `(app)/dashboards/`, `(app)/alerts/`, `(app)/reports/`, `(app)/data-sources/`. Fiecare afiseaza mesaj + buton "Try Again" cu `reset()`.
**Regula:** FIECARE route group critica TREBUIE sa aiba error.tsx cu buton retry. Verifica la fiecare route noua.

### [2026-03-23] CR03 — Dashboard export PDF bypass apiClient (lipsa X-Org-Id)

**Cauza:** `dashboards/[id]/page.tsx` folosea `fetch()` direct pentru PDF export, fara headerul `X-Org-Id`. Exportul putea esua din cauza lipsei org isolation.
**Fix:** Adaugat `X-Org-Id` header citit din localStorage (acelasi pattern ca apiClient). `fetch()` direct ramane necesar pentru blob response.
**Regula:** Cand `apiClient` nu suporta formatul raspunsului (blob, FormData), foloseste `fetch()` direct DAR include INTOTDEAUNA headerul `X-Org-Id`.

### [2026-03-23] CR03 — `<a>` tag in callback/page.tsx in loc de Link

**Cauza:** Pagina de eroare din callback avea `<a href="/login">` in loc de `<Link>` din next/link. Cauza full page reload in loc de client-side navigation.
**Fix:** Inlocuit cu `<Link>` si adaugat import `next/link`.
**Regula:** NICIODATA `<a>` tags cu href in componente React. Foloseste `Link` din `next/link` pentru navigare interna.

### [2026-03-23] CR03 — No mobile navigation (navbar overflow on small screens)

**Cauza:** Navbar-ul din `(app)/layout.tsx` avea `flex items-center gap-1` fara breakpoints responsive. Pe mobile, elementele de navigatie se suprapuneau sau dispareau.
**Fix:** Adaugat hamburger menu (`Menu`/`X` icons) vizibil pe `< md`. Desktop nav ascuns cu `hidden md:flex`. Mobile nav dropdown cu `space-y-1`.
**Regula:** FIECARE layout cu navigatie trebuie sa aiba mobile menu. Desktop: `hidden md:flex`. Mobile: hamburger + dropdown vizibil pe `md:hidden`.

### [2026-03-23] CR03 — No favicon/icon assets

**Cauza:** Directorul `public/` avea doar `robots.txt`. Niciun favicon, logo sau OG image. Tab-ul browserului arata icon default.
**Fix:** Creat `public/favicon.svg` cu brand colors (dark-navy bg, primary-blue C, primary-cyan B). Adaugat `icons: { icon: '/favicon.svg' }` in metadata din `[locale]/layout.tsx`.
**Regula:** FIECARE aplicatie web TREBUIE sa aiba favicon. Adauga-l in `public/` si referentiaza-l in metadata layout.

### [2026-03-23] CR03 — No copyright notice in footer

**Cauza:** Footer-ul din `(app)/layout.tsx` avea doar linkuri (Terms, Privacy, Cookies). Nicio mentiune de copyright sau brand.
**Fix:** Adaugat `© {year} ClarixBI SRL` in footer. Layout responsive cu `flex-col sm:flex-row sm:justify-between`.
**Regula:** Footer-ul aplicatiei TREBUIE sa includa copyright notice cu anul curent si numele companiei.

### [2026-03-23] CR03 — 404 page nebranded (culori generice, fara identitate)

**Cauza:** `app/not-found.tsx` folosea `bg-blue-600` generic in loc de culorile brand-ului. Nu avea numele ClarixBI si nu importa `globals.css`.
**Fix:** Adaugat import `globals.css`, brand name "ClarixBI", culori din tema (`bg-primary-blue`, `text-dark-navy`), mesaj descriptiv.
**Regula:** Paginile de eroare (404, 500) TREBUIE sa fie branded: logo/nume, culori din tema, mesaj helpful, link de navigare.

### [2026-03-23] CR04 — recharts + react-grid-layout importate static (~550KB in initial bundle)

**Cauza:** `WidgetCard.tsx` importa static 5 chart components (recharts ~400KB), iar dashboard view/edit importau static `react-grid-layout` (~150KB). Tot bundle-ul se incarca la prima pagina.
**Fix:** Inlocuit cu `dynamic(() => import(...), { ssr: false })` din `next/dynamic`. AiChat lazy-loaded similar.
**Regula:** Componente heavy (charts, editors, grid layouts) TREBUIE importate cu `dynamic()` si `{ ssr: false }`. Pragul: orice dependenta > 50KB.

### [2026-03-23] CR04 — text-gray-400 pe fundal alb — contrast ratio ~2.9:1 (WCAG fail)

**Cauza:** 70+ instante de `text-gray-400` pe fundal alb/deschis. Contrast ratio ~2.9:1 vs minim 4.5:1 cerut de WCAG 2.1 AA. Afecta timestamps, subtitles, metadata, footer links, helper text.
**Fix:** Inlocuit `text-gray-400` cu `text-gray-500` (~4.6:1 contrast) in 22+ fisiere. `text-gray-300` inlocuit cu `text-gray-400` pentru iconite decorative.
**Regula:** NICIODATA `text-gray-400` sau mai deschis pe fundal alb pentru text informativ. Minim `text-gray-500` pentru WCAG AA compliance. Verifica contrast cu https://webaim.org/resources/contrastchecker/.

### [2026-03-23] CR04 — 18 labels fara htmlFor + inputs fara aria-label

**Cauza:** Labels din CreateReportModal, ScheduleModal, CreateAlertWizard, WidgetConfigurator nu aveau `htmlFor`. Textarea din AiChat, select din FilterBar, input din TableWidget nu aveau label sau `aria-label`.
**Fix:** Adaugat `htmlFor` + `id` pairs pe toate labels. Adaugat `aria-label` pe inputs standalone.
**Regula:** FIECARE `<label>` TREBUIE sa aiba `htmlFor` corespunzator unui `id` pe input. FIECARE input fara label vizibil TREBUIE sa aiba `aria-label`.

### [2026-03-23] CR04 — 3 dialog-uri fara role="dialog" (settings delete, org delete, WidgetConfigurator)

**Cauza:** Confirmation dialogs din settings si organization, plus side panel-ul WidgetConfigurator nu aveau `role="dialog"`, `aria-modal="true"`, `aria-label`.
**Fix:** Adaugat atributele ARIA pe fiecare dialog/panel.
**Regula:** FIECARE overlay/modal/panel TREBUIE sa aiba `role="dialog"` + `aria-modal="true"` + `aria-label` descriptiv.

### [2026-03-23] CR04 — Skip-to-content link lipsa

**Cauza:** Keyboard users trebuiau sa treaca prin tot navbar-ul pe fiecare pagina. Violeaza WCAG 2.4.1 (Bypass Blocks).
**Fix:** Adaugat skip link `sr-only focus:not-sr-only` ca prim child in `(app)/layout.tsx`. Adaugat `id="main-content"` pe `<main>`.
**Regula:** FIECARE layout cu navigatie TREBUIE sa aiba skip-to-content link. Pattern: `<a href="#main-content" className="sr-only focus:not-sr-only ...">`.

### [2026-03-23] CR04 — Zero @ApiResponse pe toate controllerele API

**Cauza:** Niciun controller NestJS nu avea `@ApiResponse` decorators. Swagger UI nu documenta status codes (200, 400, 401, 404).
**Fix:** Adaugat `@ApiResponse`, `@ApiOperation`, `@ApiTags` pe toate 15 controllerele care lipseau.
**Regula:** FIECARE endpoint API TREBUIE sa aiba `@ApiResponse` cu status codes relevante. GET: 200. POST: 201. PUT/PATCH: 200. DELETE: 200. Toate: 401.

### [2026-03-23] CR04 — 7 endpoints cu @Body() inline (fara DTO, fara validare)

**Cauza:** Onboarding (3), alerts (1), AI (1), data-sources (1), auth (1) aveau `@Body() body: { field: type }` inline. class-validator nu valida aceste inputs.
**Fix:** Creat DTOs dedicate: StartConnectionDto, ValidateCredentialsDto, StartSyncDto, ToggleAlertDto, UpdateDataSourceDto, RefreshTokenDto. Fiecare cu decoratori class-validator.
**Regula:** NICIODATA `@Body()` cu tip inline. INTOTDEAUNA creeaza un DTO in `dto/` cu decoratori class-validator.

### [2026-03-23] CR04 — @Param() fara ParseUUIDPipe (5 instante)

**Cauza:** `organizations.controller.ts` (3x orgId) si `gdpr.controller.ts` (2x requestId) acceptau string-uri arbitrare ca parametri UUID fara validare.
**Fix:** Adaugat `ParseUUIDPipe` pe fiecare `@Param()`.
**Regula:** FIECARE `@Param()` care asteapta UUID TREBUIE sa aiba `ParseUUIDPipe`. Previne queries cu valori invalide.

### [2026-03-23] CR04 — onboarding.controller.ts fara JwtAuthGuard

**Cauza:** Controller-ul folosea doar `OrgMemberGuard` fara `JwtAuthGuard`. Potentiale requests neautentificate puteau ajunge la endpoints de onboarding.
**Fix:** Adaugat `JwtAuthGuard` in `@UseGuards(JwtAuthGuard, OrgMemberGuard)`.
**Regula:** `OrgMemberGuard` TREBUIE precedat de `JwtAuthGuard`. Guard-urile se executa in ordine — autentificarea vine PRIMA.

### [2026-03-23] CR04 — Commitlint rejecta "review" ca type

**Cauza:** Commit type "review" nu e in lista commitlint: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test.
**Fix:** Inlocuit cu "chore" pentru review commits.
**Regula:** Foloseste doar tipurile standard commitlint. Review/audit commits → `chore(scope): description`.

### [2026-03-24] CR07 — N+1 queries in alerts, reports, dashboards

**Cauza:** `checkAlerts()` facea query individual pentru fiecare trigger. `getWidgetData()` facea `findOne` per widget. `handleAlertTriggered()` facea `save` individual per notification.
**Fix:** Adaugat `relations: ['triggers']` pe alerts find. Inlocuit `findOne` loop cu `widgetRepo.find({ where: { id: In(ids) } })`. Batch `notificationRepo.save(array)`. `Promise.allSettled()` pentru email-uri.
**Regula:** NICIODATA query in loop. Foloseste `relations` pentru eager loading sau `In()` operator pentru batch queries.

### [2026-03-24] CR07 — Lipsa paginare pe 6 endpoints (dashboards, data-sources)

**Cauza:** `findAll()` in DashboardsService si DataSourcesService returna toate inregistrarile fara limit/offset. Cu date multe, cauza response-uri mari si slow queries.
**Fix:** Inlocuit `find()` cu `findAndCount()` + `take`/`skip`. Creat `PaginationDto` si `PaginatedResult<T>` partajate. Adaugat `@Query() query: PaginationDto` pe controllers.
**Regula:** FIECARE endpoint de listare TREBUIE sa aiba paginare. Foloseste `findAndCount()` + `PaginatedResult`. Default: page=1, limit=20.

### [2026-03-24] CR07 — Lipsa tranzactii pe create org + bulk widget update

**Cauza:** `organizations.create()` crea org + team member secvential fara tranzactie. `widgets.bulkUpdatePositions()` updatea pozitii individual. Failure la mijloc lasa date inconsistente.
**Fix:** Wrapped in `dataSource.transaction()`. OrganizationsService: `manager.create/save` atomic. WidgetsService: `manager.find/save` in transaction.
**Regula:** Operatii multi-step de CREATE/UPDATE TREBUIE wrappate in tranzactie.

### [2026-03-24] CR07 — auth↔billing circular dependency (forwardRef)

**Cauza:** `auth.service.ts` importa `BillingService` via `forwardRef(() => BillingService)`. Circular dependencies sunt fragile si cauza warnings NestJS.
**Fix:** Inlocuit cu `@Inject('BILLING_SERVICE')` injection token. Adaugat `{ provide: 'BILLING_SERVICE', useExisting: BillingService }` in auth.module.
**Regula:** NICIODATA `forwardRef` pentru service injection. Foloseste string tokens (`@Inject('TOKEN')`) pentru a sparge circular dependencies.

### [2026-03-24] CR07 — Math.random() in slug generation (insecure)

**Cauza:** `organizations.service.ts` si `auth.service.ts` foloseau `Math.random().toString(36)` pentru generarea slug-urilor. Math.random() nu e cryptographically secure.
**Fix:** Inlocuit cu `randomBytes(4).toString('hex').substring(0, 8)` din `node:crypto`.
**Regula:** NICIODATA `Math.random()` pentru generarea de identificatori. Foloseste `crypto.randomBytes()`.

### [2026-03-24] CR07 — 7 entitati fara @DeleteDateColumn (soft delete)

**Cauza:** AIConversation, Alert, Subscription, ReportSchedule, Report, TeamMember, Widget nu aveau `@DeleteDateColumn()`. Soft delete nu functiona corect.
**Fix:** Adaugat `@DeleteDateColumn() deleted_at: Date | null` pe fiecare entitate. Creat migratie `1774416000000-AddSoftDeleteColumns.ts`.
**Regula:** FIECARE entitate principala TREBUIE sa aiba `@DeleteDateColumn()` pentru soft delete support.

### [2026-03-24] CR07 — Enum-uri duplicate intre shared si entity files

**Cauza:** TeamRole, InviteStatus, SubscriptionStatus, BillingPeriod, DataSourceType, DataSourceStatus, WidgetType existau atat in `@clarixbi/shared` cat si in entity files. Risc de divergenta.
**Fix:** Entity files importa din `@clarixbi/shared` si re-exporta pentru backward compatibility: `import { X } from '@clarixbi/shared'; export { X };`.
**Regula:** Enum-urile partajate frontend/backend se definesc O SINGURA DATA in `@clarixbi/shared`. Entity files re-exporta.

### [2026-03-24] CR07 — Inline DTOs in teams controller

**Cauza:** `teams.controller.ts` avea DTOs inline (`@Body() body: { email: string; role: TeamRole }`) fara class-validator decorators.
**Fix:** Extras `InviteDto` si `ChangeRoleDto` in `teams/dto/`. Extras `InviteAcceptController` in fisier separat.
**Regula:** NICIODATA `@Body()` cu tip inline. Fiecare endpoint cu body trebuie sa aiba DTO dedicat cu class-validator.

### [2026-03-24] CR07 — Response caching lipsa pe GET endpoints

**Cauza:** GET endpoints (dashboards list/detail, data-sources list, overview) nu aveau caching. Fiecare request trigera query DB complet.
**Fix:** Adaugat `CacheModule.register({ ttl: 60, max: 100, isGlobal: true })` in AppModule. Adaugat `@UseInterceptors(CacheInterceptor)` + `@CacheTTL()` pe GET endpoints.
**Regula:** GET endpoints frecvent accesate TREBUIE sa aiba `@CacheInterceptor` + `@CacheTTL` appropriate (list: 30s, detail: 10s, overview: 60s).

### [2026-03-24] CR07 — Magic numbers in auth.controller.ts

**Cauza:** `auth.controller.ts` avea 4 magic numbers: `7 * 24 * 60 * 60 * 1000` (refresh cookie maxAge), `60000` (throttle TTL), `10` (auth throttle limit), `5` (refresh throttle limit).
**Fix:** Extras ca constante numite: `REFRESH_TOKEN_MAX_AGE_MS`, `THROTTLE_TTL_MS`, `AUTH_THROTTLE_LIMIT`, `REFRESH_THROTTLE_LIMIT`.
**Regula:** NICIODATA magic numbers in cod. Extrage constante numite cu sens clar.
