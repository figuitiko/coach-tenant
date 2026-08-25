import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

describe("pilot readiness contract", () => {
  it("provides a guarded deterministic seed and a documented command", () => {
    const config = read("prisma.config.ts");
    const seed = read("prisma/seed.ts");
    const reset = read("prisma/pilot-reset.ts");
    expect(config).toContain('seed: "tsx prisma/seed.ts"');
    expect(seed).toContain('NODE_ENV === "production"');
    expect(seed).toContain("pilot.admin@tenand.local");
    expect(seed).toContain("coach.fuerzanorte@tenand.local");
    expect(seed).toContain("coach.movimientosur@tenand.local");
    expect(seed).toContain('platformRole: "SUPER_ADMIN"');
    expect(seed).toContain('ownerId: northCoach.id');
    expect(seed).toContain('ownerId: southCoach.id');
    expect(seed).not.toContain('userId: admin.id, role: "COACH"');
    expect(read("e2e/pilot-journeys.spec.ts")).toContain("coach.fuerzanorte@tenand.local");
    expect(read("e2e/pilot-mobile.spec.ts")).toContain("coach.fuerzanorte@tenand.local");
    expect(read("e2e/pilot-journeys.spec.ts")).not.toContain("pilot.coach@tenand.local");
    const operations = read("docs/operations.md");
    expect(operations).toContain("pilot.admin@tenand.local");
    expect(operations).toContain("coach.fuerzanorte@tenand.local");
    expect(operations).toContain("coach.movimientosur@tenand.local");
    expect(seed.match(/pilot\.student\d@tenand\.local/g)?.length).toBeGreaterThanOrEqual(5);
    expect(seed).toContain('status: "IN_PROGRESS"');
    expect(seed).toContain('status: "COMPLETED"');
    expect(seed).toContain("pilot-active-invitation-token");
    expect(seed).toContain("resetPilotFixtures(prisma)");
    expect(reset).toContain("pilot.invited@tenand.local");
    expect(seed).toContain("pilot-review-note-completed");
    expect(seed).not.toContain("prisma.progressPhoto.create");
    expect(seed).not.toContain("prisma.photoUploadIntent.create");
    expect(read("docs/operations.md")).toMatch(/optional media seed/i);
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
    expect(workflow).toContain("pnpm test:e2e:public");
    expect(workflow).toContain("pnpm test:e2e:pilot");
    expect(workflow).toContain("TEST_DATABASE_URL");
    expect(read("playwright.config.ts")).toContain('name: "pilot-postgres"');
    expect(read("playwright.config.ts")).toContain('name: "pilot-mobile-postgres"');
    const mobilePilot = read("e2e/pilot-mobile.spec.ts");
    expect(mobilePilot).toContain('devices["Pixel 7"]');
    expect(mobilePilot.match(/newContext\(pixel7\)/g)).toHaveLength(2);
  });

  it("pins authenticated E2E to the browser origin and injects one ephemeral seed password", () => {
    const origin = "http://127.0.0.1:3000";
    const workflow = read(".github/workflows/quality.yml");
    const runner = read("scripts/run-pilot-e2e.mjs");
    const playwright = read("playwright.config.ts");
    const passwordConsumers = [read("prisma/seed.ts"), read("e2e/pilot-journeys.spec.ts"), read("e2e/pilot-mobile.spec.ts")];

    expect(playwright).toContain(`baseURL: "${origin}"`);
    expect(playwright).toContain(`url: "${origin}"`);
    expect(runner).toContain(`const pilotOrigin = "${origin}"`);
    expect(runner).toContain("BETTER_AUTH_URL: pilotOrigin");
    expect(runner).toContain("PILOT_SEED_PASSWORD is required");
    expect(workflow).toContain('pilot_password="$(openssl rand -base64 36)"');
    expect(workflow).toContain('echo "::add-mask::$pilot_password"');
    expect(workflow).toContain('PILOT_SEED_PASSWORD=$pilot_password');
    for (const consumer of passwordConsumers) expect(consumer).not.toMatch(/PILOT_SEED_PASSWORD\s*\?\?/);
  });

  it("fails fast on invalid production environment at server startup", () => {
    expect(read("src/instrumentation.ts")).toContain("validateProductionEnvironment");
  });
});
