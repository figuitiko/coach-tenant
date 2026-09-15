import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

integration("deterministic pilot seed reset against PostgreSQL", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const suffix = Date.now();
  const ownerId = `seed-reset-owner-${suffix}`;
  const workspaceId = `seed-reset-workspace-${suffix}`;

  beforeAll(async () => {
    await database.user.create({ data: { id: ownerId, name: "Non-pilot owner", email: `${ownerId}@example.test` } });
    await database.workspace.create({ data: { id: workspaceId, slug: `non-pilot-${suffix}`, name: "Non-pilot workspace", ownerId } });
  });

  afterAll(async () => {
    await database.workspace.deleteMany({ where: { id: workspaceId } });
    await database.user.deleteMany({ where: { id: ownerId } });
    await database.$disconnect();
  });

  it("can seed twice without duplicates and preserves non-pilot tenants", { timeout: 30_000 }, async () => {
    const landingHashes: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = spawnSync("pnpm", ["prisma", "db", "seed"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: testDatabaseUrl! },
        encoding: "utf8",
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      landingHashes.push((await database.coachLandingRevision.findUniqueOrThrow({ where: { id: "pilot-landing-revision-1" } })).payloadHash);
    }

    expect(landingHashes[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(landingHashes).size).toBe(1);

    const pilotWorkspaceIds = ["pilot-workspace-north", "pilot-workspace-south"];
    expect(await database.workspace.count({ where: { id: { in: pilotWorkspaceIds } } })).toBe(2);
    expect(await database.user.count({ where: { id: { in: ["pilot-admin", "pilot-coach-north", "pilot-coach-south", "pilot-student-1", "pilot-student-2", "pilot-student-3", "pilot-student-4", "pilot-student-5"] } } })).toBe(8);
    expect(await database.exercise.count({ where: { workspaceId: "pilot-workspace-north" } })).toBe(4);
    expect(await database.workoutTemplate.count({ where: { workspaceId: "pilot-workspace-north" } })).toBe(2);
    expect(await database.workoutPlan.count({ where: { workspaceId: "pilot-workspace-north" } })).toBe(1);
    expect(await database.assignedWorkout.count({ where: { workspaceId: "pilot-workspace-north" } })).toBe(2);
    expect(await database.measurementCheckIn.count({ where: { workspaceId: "pilot-workspace-north" } })).toBe(2);
    expect(await database.reviewNote.count({ where: { workspaceId: "pilot-workspace-north" } })).toBe(1);
    const seededResult = await database.studentResultVersion.findUniqueOrThrow({
      where: { id: "pilot-result-version-1" },
      include: { approval: true, metrics: true },
    });
    expect(seededResult.approval?.approvedFingerprint).toBe(seededResult.payloadHash);
    expect(seededResult.metrics).toHaveLength(1);
    expect(await database.workspace.count({ where: { id: workspaceId } })).toBe(1);
  });
});
