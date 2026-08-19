import { readFileSync } from "node:fs";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("PostgreSQL integration quality contract", () => {
  it("fails clearly instead of skipping when TEST_DATABASE_URL is missing", () => {
    const environment = { ...process.env };
    delete environment.TEST_DATABASE_URL;
    const result = spawnSync(process.execPath, ["scripts/run-pg-integration-tests.mjs"], {
      cwd: projectRoot,
      env: environment,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("TEST_DATABASE_URL is required");
  });

  it("runs the dedicated integration config against the test database", () => {
    const binDirectory = mkdtempSync(`${tmpdir()}/coach-tenand-pg-runner-`);
    const captureFile = `${binDirectory}/capture.txt`;
    const fakePnpm = `${binDirectory}/pnpm`;
    writeFileSync(fakePnpm, `#!/bin/sh\necho "DATABASE_URL=$DATABASE_URL" > "$CAPTURE_FILE"\nprintf '%s\\n' "$@" >> "$CAPTURE_FILE"\n`);
    chmodSync(fakePnpm, 0o755);
    const testUrl = "postgresql://postgres:postgres@localhost:5432/coach_test";

    const result = spawnSync(process.execPath, ["scripts/run-pg-integration-tests.mjs"], {
      cwd: projectRoot,
      env: { ...process.env, PATH: `${binDirectory}:${process.env.PATH}`, CAPTURE_FILE: captureFile, TEST_DATABASE_URL: testUrl },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(readFileSync(captureFile, "utf8")).toBe([
      `DATABASE_URL=${testUrl}`,
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.integration.config.mts",
      "",
    ].join("\n"));
  });

  it("keeps unit and PostgreSQL integration commands separate", () => {
    const packageJson = JSON.parse(readFileSync(`${projectRoot}/package.json`, "utf8")) as { scripts: Record<string, string> };

    expect(packageJson.scripts.test).not.toMatch(/integration/i);
    expect(packageJson.scripts["test:integration:pg"]).toContain("run-pg-integration-tests.mjs");
  });

  it("runs PostgreSQL migrations and mandatory integration checks in CI without building", () => {
    const workflow = readFileSync(`${projectRoot}/.github/workflows/quality.yml`, "utf8");

    expect(workflow).toMatch(/services:\s*\n\s*postgres:/);
    expect(workflow).toContain("pnpm prisma migrate deploy");
    expect(workflow).toContain("pnpm test:integration:pg");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).not.toMatch(/pnpm (run )?build/);
  });
});
