# ClarixBI

Business Intelligence platform for Romanian SMBs.

## Prerequisites

- Node.js 20.x
- npm 10.x
- Docker & Docker Compose

## Getting Started

```bash
# Clone repository
git clone <repo-url> clarixbi
cd clarixbi

# Install dependencies
npm install

# Start infrastructure (Postgres, Redis, ClickHouse)
docker-compose up -d

# Start development servers (web on :3000, api on :4000)
npm run dev
```

## Project Structure

```
clarixbi/
├── apps/
│   ├── web/          # Next.js 14 (App Router) — port 3000
│   └── api/          # NestJS 10 — port 4000
├── packages/
│   └── shared/       # Shared TypeScript types + Zod schemas
└── docker-compose.yml
```

## Scripts

| Command             | Description                |
| ------------------- | -------------------------- |
| `npm run dev`       | Start all dev servers      |
| `npm run dev:web`   | Start frontend only        |
| `npm run dev:api`   | Start backend only         |
| `npm run build`     | Build all packages         |
| `npm run lint`      | Run ESLint                 |
| `npm run typecheck` | Run TypeScript type checks |
| `npm run test`      | Run all tests              |
| `npm run format`    | Format code with Prettier  |

## API Docs

Swagger UI available at http://localhost:4000/api/docs when the API is running.
