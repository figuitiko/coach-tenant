import { spawnSync } from "node:child_process";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is required to run PostgreSQL integration tests. Refusing to skip them.");
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "--config", "vitest.integration.config.mts"],
  {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl, TEST_DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Unable to start PostgreSQL integration tests: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
