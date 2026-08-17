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
