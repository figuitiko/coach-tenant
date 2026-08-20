# Tenand

Mobile-first coaching workspace for planning training, reviewing workout logs, and following student progress.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Quality checks

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm test:e2e
```

The project uses the Next.js App Router, TypeScript, Tailwind CSS, Vitest + Testing Library, and Playwright. Production code lives in `src/`; domain modules are isolated below `src/modules/` with application, domain, and infrastructure boundaries.

## PostgreSQL integration tests

`pnpm test` intentionally runs the fast local unit/component suite only. PostgreSQL repository and
concurrency tests use a separate mandatory command: it exits with an error rather than silently skipping
when `TEST_DATABASE_URL` is absent. Apply migrations to a disposable PostgreSQL database, then run:

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coach_tenand_test"
DATABASE_URL="$TEST_DATABASE_URL" pnpm prisma migrate deploy
pnpm test:integration:pg
```

CI provisions PostgreSQL, applies every migration, and runs both `pnpm test` and
`pnpm test:integration:pg` before lint and type checking.

## Pilot runbook

See [operations](docs/operations.md), [architecture and security](docs/architecture-security.md), and the [pilot acceptance checklist](docs/pilot-acceptance.md).
