# Contributing to ClarixBI

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start infrastructure: `docker compose up -d`
4. Copy env files and configure credentials
5. Run migrations: `npm run db:migrate`
6. Start dev: `npm run dev`

## Coding Standards

- TypeScript strict mode — zero `any` in production code
- Single quotes, semicolons, trailing commas, 2-space indent
- Run `npm run lint && npm run typecheck` before committing
- No `console.log` in production code

## Git Workflow

- Conventional Commits: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore, perf
- Scopes: clarixbi, api, web, shared
- Branch naming: `feat/description`, `fix/description`
- Feature branch → develop → main

## Testing

- Test files: `*.spec.ts` (co-located)
- Mock external services (Stripe, Auth0, ClickHouse)
- Run tests: `npm run test`
- Coverage thresholds: 60% lines, 55% functions, 50% branches

## Frontend Rules

- Every page: loading state, error state, empty state
- Every string: `useTranslations()` — update both en.json and ro.json
- Every modal: `role="dialog"` + `aria-modal="true"` + `aria-label`
- Every button without text: `aria-label`
- Use `apiClient` for all API calls (adds X-Org-Id automatically)

## Backend Rules

- Every DTO: class-validator decorators
- Every controller: @ApiOperation, @ApiResponse
- Every FK column: @Index() decorator
- Every entity: @DeleteDateColumn for soft delete
- Never use `redis.keys()` — use `redis.scan()`
