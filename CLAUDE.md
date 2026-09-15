# CLAUDE.md

## TDD Preference Rule

At the start of every new implementation round, batch, feature, bugfix, refactor, or behavior-change task, ask the user whether they want to use strict TDD for that round before applying it. If the user says yes, follow strict RED → GREEN → REFACTOR and show evidence. If the user says no, do not enforce strict TDD for that round, but still add reasonable tests when they are needed to protect behavior. If the user already explicitly requested TDD for the current round or the active task/plan says TDD is mandatory, do not ask again for that same round; follow TDD. Ask again on the next new round.

## Test File Write Approval

Before creating or modifying any test file (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, including under `e2e/`), stop and ask the user for explicit approval first — state which file and why, then wait for a yes before writing. This applies even when the round is proceeding without strict TDD. Enforced in this repo via a `.claude/settings.json` PreToolUse hook.

## Playwright Execution Approval

Never run any `pnpm test:e2e:*` command or `pnpm exec playwright test ...` unless the user explicitly asks for it in that message. "Verify", "run tests", or "finish the batch" mean the Vitest suite (`pnpm test`) only, unless Playwright/e2e is named specifically.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                # start Next.js dev server
pnpm lint                # eslint .
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest run — fast unit/component suite (jsdom), excludes e2e/** and *.integration.test.ts
pnpm test:watch          # vitest watch mode
pnpm test -- path/to/file.test.ts        # single unit test file
pnpm test -- -t "test name"              # filter by test name
```

PostgreSQL-backed suites are separate and **fail closed** (exit 1, not skip) when their DB URL is absent:

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coach_tenand_test"
DATABASE_URL="$TEST_DATABASE_URL" pnpm prisma migrate deploy
pnpm test:integration:pg                                   # node env, src/**/*.integration.test.ts
pnpm test:integration:pg -- --config vitest.integration.config.mts -t "name"  # single test

PILOT_SEED_PASSWORD="$(openssl rand -base64 36)" pnpm test:e2e:pilot   # authenticated Playwright journeys against real Postgres, migrates+reseeds first
pnpm test:e2e:public                                        # chromium + mobile-chrome projects, unauthenticated public shell only
pnpm exec playwright test e2e/public-shell.spec.ts          # single e2e file (public projects)
```

**Never run `pnpm build` or `next build`.** This is enforced by a contract test that greps `.github/workflows/quality.yml` for the absence of a build step (`scripts/quality-contract.test.ts`).

## Architecture

Tenand is a **server-first modular monolith** on the Next.js App Router. Four domain modules live under `src/modules/`: `identity`, `tenancy`, `training`, `progress`. Each is (or will be) layered `domain/` → `application/` → `infrastructure/` → `presentation/` (see `src/modules/README.md`). App Router pages/route handlers call application-layer services; presentation components receive serializable DTOs and must never import Prisma directly — persistence lives only in `infrastructure/`.

### Multi-tenancy and authorization

Every authenticated operation resolves a global user plus a workspace membership and scopes all reads/writes by `workspaceId`. Two role dimensions are deliberately separate (`docs/architecture-security.md`):

- `User.platformRole`: platform scope, `USER` | `SUPER_ADMIN`.
- `Membership.role`: tenant scope, `COACH` | `STUDENT`.

A `SUPER_ADMIN` gets explicit workspace access without a synthetic membership row (see `isWorkspaceRoleAuthorized` in `src/modules/tenancy/infrastructure/workspace-role-authorization.ts` — it checks membership first, then falls back to platform role only for `COACH`-level checks). Repository mutations recheck ownership inside transactions; a URL/ID from another tenant is never trusted as authority, and UI hidden links are never authorization.

### Private media

Progress photos store only object metadata (bucket key, MIME, size, SHA-256 checksum) in Postgres and are served through an authenticated, tenant-scoped route — never a public S3 URL. Object key scope is `workspaces/{workspaceId}/students/{studentId}/progress/{object}`. Upload intents are presigned, single-use, and capped by `S3_MAX_UPLOAD_BYTES` (default 5 MiB).

### Environment validation

`src/shared/infrastructure/env.ts` exports two schemas: `validateServerEnvironment` (lenient, dev-friendly) and `validateProductionEnvironment` (strict — requires `BETTER_AUTH_SECRET` ≥32 chars, SMTP creds, full S3 config). `src/instrumentation.ts` calls the production validator at server startup so a misconfigured deploy fails fast instead of serving traffic.

### Auth

Better Auth + Prisma adapter (`src/modules/identity/infrastructure/auth.ts`, `auth-client.ts`). Invitations are single-use and expiring (`src/modules/tenancy/domain/invitation.ts`). `/api/health` reports only `ready/not_ready` + DB `up/down` — never leak connection strings or exception messages there (a contract test greps for this).

## Contract tests — read before editing certain files

`scripts/quality-contract.test.ts`, `scripts/pilot-readiness-contract.test.ts`, and `scripts/pilot-workflow-contract.test.ts` assert **literal strings** inside non-code files: `docs/operations.md`, `docs/architecture-security.md`, `.github/workflows/quality.yml`, `playwright.config.ts`, `next.config.ts`, `prisma/seed.ts`, `prisma/pilot-reset.ts`, `e2e/pilot-journeys.spec.ts`, `e2e/pilot-mobile.spec.ts`. Editing any of these without checking the matching contract test will break `pnpm test` in a way that looks unrelated to your change — grep the three contract files for the filename you're touching first.

Notable invariants those tests pin down:
- Pilot seed fixtures use fixed emails (`pilot.admin@tenand.local`, `coach.fuerzanorte@tenand.local`, `coach.movimientosur@tenand.local`, `pilot.student{1..5}@tenand.local`) and never seed progress photos or public photo URLs.
- `PILOT_SEED_PASSWORD` must never have a fallback default (`?? "..."`) in seed/e2e code — CI injects one ephemeral value via `openssl rand -base64 36` and masks it.
- Playwright pilot projects are pinned to `http://127.0.0.1:3000` and run serialized (`workers: 1`), not parallel.
- `next.config.ts` must set CSP/Referrer-Policy/X-Content-Type-Options/X-Frame-Options/Permissions-Policy headers and `allowedDevOrigins: ["127.0.0.1"]`.
