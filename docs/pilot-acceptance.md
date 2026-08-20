# Pilot acceptance checklist

- [ ] Coach signs in and sees the correct tenant, five-student roster and role navigation.
- [ ] Multi-workspace student can switch workspaces without seeing cross-tenant data.
- [ ] Coach can create exercises/templates, date a plan and assign it to a student.
- [ ] Student can open a dated workout, save sets and complete the session from mobile.
- [ ] Student can save/submit a measurement check-in and attach only a private, checksum-bound photo.
- [ ] Coach review queue includes completed workouts/check-ins and accepts an idempotent note.
- [ ] Loading, recoverable error, intentional empty, pending, success and error states are understandable and accessible.
- [ ] Cross-tenant identifiers are rejected; photo objects have no public URL or ACL.
- [ ] Unit, fail-closed PostgreSQL, lint, typecheck, Prisma validation/generation and Playwright suites pass without a build.
- [ ] `/api/health` is ready, backup/restore is rehearsed, SMTP works, and private bucket CORS is restricted.
- [ ] No nutrition, public gallery, billing, chat, or team-management functionality entered the pilot.
