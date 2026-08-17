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

The invitation repository integration suite never substitutes SQLite for PostgreSQL. Apply migrations
to a disposable PostgreSQL database, then run the gated suite:

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coach_tenand_test"
DATABASE_URL="$TEST_DATABASE_URL" pnpm prisma migrate deploy
pnpm vitest run src/modules/tenancy/infrastructure/prisma-invitation.integration.test.ts
```

Without `TEST_DATABASE_URL`, the suite is reported as skipped.
