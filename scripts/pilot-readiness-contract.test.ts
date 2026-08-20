import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

describe("pilot readiness contract", () => {
  it("provides a guarded deterministic seed and a documented command", () => {
    const config = read("prisma.config.ts");
    const seed = read("prisma/seed.ts");
    expect(config).toContain('seed: "tsx prisma/seed.ts"');
    expect(seed).toContain('NODE_ENV === "production"');
    expect(seed).toContain("pilot.coach@tenand.local");
    expect(seed.match(/pilot\.student\d@tenand\.local/g)?.length).toBeGreaterThanOrEqual(5);
    expect(seed).toContain('status: "IN_PROGRESS"');
    expect(seed).toContain('status: "COMPLETED"');
    expect(seed).toContain("ProgressPhoto");
    expect(seed).not.toMatch(/https?:\/\/.*photo/i);
  });

  it("sets defensive browser headers and exposes a non-secret health route", () => {
    const config = read("next.config.ts");
    const health = read("src/app/api/health/route.ts");
    for (const header of ["Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options", "Permissions-Policy"]) {
      expect(config).toContain(header);
    }
    expect(config).toContain('allowedDevOrigins: ["127.0.0.1"]');
    expect(health).toContain("evaluateReadiness");
    expect(health).not.toContain("DATABASE_URL");
  });

  it("documents operations, private upload constraints, architecture and acceptance", () => {
    const operations = read("docs/operations.md");
    expect(operations).toMatch(/TEST_DATABASE_URL/);
    expect(operations).toMatch(/CORS/);
    expect(operations).toMatch(/checksum/i);
    expect(operations).toMatch(/backup/i);
    expect(operations).toMatch(/never.*build/i);
    expect(read("docs/architecture-security.md")).toMatch(/tenant/i);
    expect(read("docs/pilot-acceptance.md")).toMatch(/checklist/i);
  });

  it("keeps authenticated PostgreSQL E2E mandatory in CI", () => {
    const workflow = read(".github/workflows/quality.yml");
    expect(workflow).toContain("pnpm test:e2e:pilot");
    expect(workflow).toContain("TEST_DATABASE_URL");
    expect(read("playwright.config.ts")).toContain('name: "pilot-postgres"');
  });
});
