# Pilot operations

## Environment

Copy `.env.example` to `.env.local`. Required runtime values are `DATABASE_URL`, `BETTER_AUTH_SECRET` (at least 32 random characters), `BETTER_AUTH_URL`, SMTP host/port/from and credentials, plus the S3-compatible endpoint, region, bucket and credentials. `S3_MAX_UPLOAD_BYTES` defaults to 5 MiB. Secrets belong in the deployment secret store, never in Git. Non-secret URLs, ports and upload limits are validated by `validateServerEnvironment`.

## Local PostgreSQL and seed

Create separate development and test PostgreSQL databases, then:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coach_tenand pnpm prisma migrate deploy
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coach_tenand pnpm prisma db seed
pnpm dev
```

The seed recreates only `fuerza-norte-pilot` and `movimiento-sur-pilot`. Local accounts use `PILOT_SEED_PASSWORD` (documented default only for local pilot data). Production seeding fails unless an operator explicitly sets `ALLOW_PRODUCTION_SEED=true` during an intentional reset.

Local pilot identities are intentionally separated:

- `pilot.admin@tenand.local` is the platform `SUPER_ADMIN`; it has no tenant membership and selects either workspace through explicit global admin context.
- `coach.fuerzanorte@tenand.local` is an ordinary `USER`, owner and `COACH` only in Fuerza Norte.
- `coach.movimientosur@tenand.local` is an ordinary `USER`, owner and `COACH` only in Movimiento Sur.
- `pilot.student1@tenand.local` remains a normal student member of both workspaces to exercise multi-workspace membership selection.

All use the local-only seed password. Never reuse these credentials or enable the pilot seed in a real production dataset.

## Auth and SMTP

Use an HTTPS `BETTER_AUTH_URL` in production and a high-entropy secret. Configure a verified SMTP sender. Password reset links must resolve to the deployed origin; do not log link tokens or invitation tokens. Rotate SMTP credentials through the provider and secret store.

## Private S3-compatible storage

The bucket MUST be private: block public ACLs/policies and do not serve object URLs. The app persists opaque object keys and reads through an authenticated, tenant-scoped route. Allow CORS `PUT` only from the deployed app origin and allow the exact signed headers. Current uploads accept JPEG, PNG and WebP up to **5 MiB**. The client sends a SHA-256 checksum; storage metadata and the final attachment must match MIME type, size and checksum. Presigned intents expire and are single-use.

### Optional media seed

The default pilot seed intentionally creates check-in and review records **without** photo metadata because a database row without a matching private object is broken data. If an optional media seed is added later, provision the object first in the configured private bucket, use the exact `workspaces/{workspaceId}/students/{studentId}/progress/{object}` scope, then persist matching MIME type, byte size, and SHA-256 checksum metadata. Never seed a public URL.

## Verification (agents never build)

Agents MUST NOT run `next build` or `pnpm build`. Required checks are:

```bash
pnpm test
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coach_tenand_test pnpm test:integration:pg
pnpm lint
pnpm typecheck
pnpm prisma validate
pnpm prisma generate
pnpm exec playwright test --list
pnpm test:e2e:public
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/coach_tenand_test pnpm test:e2e:pilot
```

The PostgreSQL suites fail closed when `TEST_DATABASE_URL` is absent. The pilot E2E command migrates and reseeds real PostgreSQL before exercising authenticated journeys.

## Deployment

1. Provision PostgreSQL and a private S3-compatible bucket; configure CORS and lifecycle rules.
2. Store environment secrets and set non-secret URLs/limits.
3. Run `pnpm prisma migrate deploy` as a release step.
4. Start the app with the platform's Next.js runtime command.
5. Require `/api/health` to return `200` before traffic. It reports only `ready/not_ready` and database `up/down`.
6. Verify sign-in, one student log, one check-in and one coach review in the target workspace.

## Backup and pilot reset

Take an encrypted PostgreSQL backup (`pg_dump --format=custom`) before migrations or resets and verify a restore in a disposable database. Back up the private object bucket with versioning or provider replication. For a local pilot reset, rerun `pnpm prisma db seed`; it replaces only the two named pilot workspaces and their fixed fixture users. A production reset requires an approved maintenance window, fresh database/object backups, explicit `ALLOW_PRODUCTION_SEED=true`, and a post-reset acceptance pass.
