# ClarixBI

Business Intelligence platform for Romanian SMBs. Built with Next.js 14, NestJS 10, PostgreSQL, ClickHouse, and Redis.

---

## Prerequisites

- **Node.js** 20.x (LTS)
- **npm** 10.x (ships with Node 20)
- **Docker** and **Docker Compose** (for local PostgreSQL, Redis, ClickHouse)

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url> clarixbi
cd clarixbi
```

### 2. Install dependencies

```bash
npm install
```

This installs dependencies for all workspaces (`apps/web`, `apps/api`, `packages/shared`).

### 3. Environment setup

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

- **DATABASE_URL** — PostgreSQL connection string (default works with Docker Compose)
- **CLICKHOUSE_URL** — ClickHouse HTTP endpoint (default works with Docker Compose)
- **REDIS_URL** — Redis connection string (default works with Docker Compose)
- **AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET** — Auth0 tenant credentials
- **JWT_SECRET** — Secret for signing JWTs (change from default in production)
- **STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET** — Stripe API keys (required for billing)
- **CLAUDE_API_KEY** — Anthropic Claude API key (required for AI assistant)
- **ENCRYPTION_KEY** — 64-character hex string for AES-256-GCM encryption of connector credentials

For local development, the database, ClickHouse, and Redis URLs from `.env.example` work with the default Docker Compose setup.

### 4. Start Docker services

```bash
docker-compose up -d
```

This starts:

- **PostgreSQL 15** on port 5432 (database: `clarixbi_dev`, user: `clarixbi`)
- **Redis 7** on port 6379
- **ClickHouse** on ports 8123 (HTTP) and 9000 (native)

Verify services are running:

```bash
docker-compose ps
```

### 5. Database setup

Run migrations to create the database schema:

```bash
npm run migration:run --workspace=apps/api
```

Seed initial data (subscription plans):

```bash
npm run seed --workspace=apps/api
```

### 6. Start development servers

```bash
npm run dev
```

This starts both servers concurrently:

- **Frontend (Next.js):** http://localhost:3000
- **API (NestJS):** http://localhost:4000
- **API Docs (Swagger):** http://localhost:4000/api/docs

To start individually:

```bash
npm run dev:web   # Frontend only
npm run dev:api   # Backend only
```

---

## Project Structure

```
clarixbi/
├── apps/
│   ├── web/              # Next.js 14 (App Router) — port 3000
│   │   ├── src/
│   │   │   ├── app/      # App Router pages (locale-based routing)
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── providers/
│   │   │   └── middleware.ts
│   │   ├── messages/     # i18n translations (en, ro)
│   │   └── e2e/          # Playwright E2E tests
│   └── api/              # NestJS 10 — port 4000
│       ├── src/
│       │   ├── modules/  # Feature modules (auth, billing, ai, sync, etc.)
│       │   ├── common/   # Guards, decorators, filters
│       │   ├── config/   # Sentry, database config
│       │   └── seeds/    # Database seeders
│       └── test/         # E2E tests
├── packages/
│   └── shared/           # Shared TypeScript types + Zod schemas
├── docker-compose.yml    # Local dev infrastructure
├── .env.example          # Environment variable template
├── DEPLOYMENT.md         # Production deployment guide
├── RUNBOOK.md            # Operational troubleshooting guide
└── SECURITY_AUDIT.md     # Security audit report
```

---

## Scripts

| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | Start all dev servers (web + api)     |
| `npm run dev:web`       | Start frontend only                   |
| `npm run dev:api`       | Start backend only                    |
| `npm run build`         | Build all packages (shared, web, api) |
| `npm run build:web`     | Build frontend only                   |
| `npm run build:api`     | Build backend only                    |
| `npm run lint`          | Run ESLint across all workspaces      |
| `npm run lint:fix`      | Run ESLint with auto-fix              |
| `npm run typecheck`     | Run TypeScript type checks            |
| `npm run test`          | Run all unit tests                    |
| `npm run test:coverage` | Run API tests with coverage           |
| `npm run format`        | Format code with Prettier             |

---

## Testing

### Unit Tests

```bash
npm run test
```

Runs unit tests across all workspaces using Jest.

### API Tests with Coverage

```bash
npm run test:coverage
```

### E2E Tests

```bash
# Frontend E2E (Playwright)
npm run test:e2e --workspace=apps/web

# API E2E
npm run test:e2e --workspace=apps/api
```

Ensure Docker services are running and the database is seeded before running E2E tests.

---

## Build

```bash
npm run build
```

Builds all packages in dependency order:

1. `packages/shared` (TypeScript types and Zod schemas)
2. `apps/web` (Next.js production build)
3. `apps/api` (NestJS compilation to `dist/`)

---

## API Docs

Swagger UI is available at http://localhost:4000/api/docs when the API is running in development.

---

## Key Features

- **Data Connectors:** SmartBill (Romanian invoicing), WooCommerce, CSV upload
- **Dashboard Builder:** Drag-and-drop grid, configurable widgets, global date/org filters
- **AI Assistant:** Natural language to SQL via Claude API with SQL validation and whitelisting
- **Billing:** Stripe integration with subscription plans
- **Internationalization:** Romanian and English (next-intl)
- **GDPR Compliance:** Data export, right to deletion, audit logging, cookie consent
- **Security:** Helmet, CSP, HSTS, rate limiting, encrypted credentials, httpOnly cookies

---

## Additional Documentation

- [Deployment Guide](./DEPLOYMENT.md) — Production deployment to Vercel, Railway, Supabase, ClickHouse Cloud, Upstash
- [Runbook](./RUNBOOK.md) — Operational troubleshooting for common production issues
- [Security Audit](./SECURITY_AUDIT.md) — Security findings and recommendations
