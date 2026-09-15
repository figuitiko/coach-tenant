import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const originalMigration = "prisma/migrations/20260830181322_marketing_landing/migration.sql";
const integrityMigration = "prisma/migrations/20260903033000_marketing_consent_integrity/migration.sql";

describe("marketing migration history", () => {
  it("keeps the originally deployed landing migration byte-for-byte immutable", () => {
    const sql = readFileSync(originalMigration);
    expect(createHash("sha256").update(sql).digest("hex")).toBe(
      "7f59f7d0730d2097b463d67ab5f3f3f176294209bba655333fffb9edbfe67958",
    );
  });

  it("upgrades only the consent-integrity indexes and constraints", () => {
    const sql = readFileSync(integrityMigration, "utf8");

    expect(sql).toContain('DROP CONSTRAINT "StudentResultStory_currentVersionId_workspaceId_fkey"');
    expect(sql).toContain('DROP INDEX "StudentResultStory_currentVersionId_workspaceId_key"');
    expect(sql).toContain('REFERENCES "StudentResultVersion"("id", "storyId", "workspaceId") ON DELETE RESTRICT');
    expect(sql).toContain('REFERENCES "Membership"("id", "workspaceId") ON DELETE RESTRICT');
    expect(sql).toContain('REFERENCES "StudentResultVersion"("id", "workspaceId") ON DELETE RESTRICT');
    expect(sql).not.toMatch(/\b(?:CREATE|DROP) TABLE\b|\bTRUNCATE\b|\b(?:DELETE|UPDATE) FROM\b|ALTER COLUMN/i);
  });
});
