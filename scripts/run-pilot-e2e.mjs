import { spawnSync } from "node:child_process";
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const pilotSeedPassword = process.env.PILOT_SEED_PASSWORD?.trim();
const pilotOrigin = "http://127.0.0.1:3000";

if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is required for the mandatory pilot E2E suite.");
  process.exit(1);
}
if (!pilotSeedPassword) {
  console.error("PILOT_SEED_PASSWORD is required for the mandatory pilot E2E suite.");
  process.exit(1);
}

const testEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  PILOT_SEED_PASSWORD: pilotSeedPassword,
  BETTER_AUTH_URL: pilotOrigin,
};

for (const [command, args, env] of [
  ["pnpm", ["prisma", "migrate", "deploy"], testEnvironment],
  ["pnpm", ["prisma", "db", "seed"], { ...testEnvironment, NODE_ENV: "test" }],
  ["pnpm", ["playwright", "test", "--project=pilot-postgres", "--project=pilot-mobile-postgres"], testEnvironment],
]) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
