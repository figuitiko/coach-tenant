import { spawnSync } from "node:child_process";
if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL is required for the mandatory pilot E2E suite.");
  process.exit(1);
}
for (const [command, args, env] of [
  ["pnpm", ["prisma", "migrate", "deploy"], { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }],
  ["pnpm", ["prisma", "db", "seed"], { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: "test" }],
  ["pnpm", ["playwright", "test", "--project=pilot-postgres", "--project=pilot-mobile-postgres"], { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }],
]) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
