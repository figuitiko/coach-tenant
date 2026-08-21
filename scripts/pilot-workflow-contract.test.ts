import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

describe("explicit coach to student pilot workflow", () => {
  it("persists bounded review replies and shared workspace navigation", () => {
    expect(read("prisma/schema.prisma")).toContain("model ReviewReply");
    const navigation = read("src/components/shell/workspace-navigation.tsx");
    expect(navigation).toContain("WorkspaceNavigation");
    for (const route of ["students", "training", "progress"]) expect(read(`src/app/w/[workspaceSlug]/${route}/page.tsx`)).toContain("WorkspaceNavigation");
  });

  it("keeps the authenticated workflow mandatory in PostgreSQL E2E", () => {
    const journey = read("e2e/pilot-journeys.spec.ts");
    expect(journey).toMatch(/gestionar entrenamiento/i);
    expect(journey).toMatch(/día siguiente|tu plan asignado/i);
    expect(journey).toMatch(/responder a la devolución/i);
    expect(journey).toMatch(/respuestas de alumnos/i);
    expect(journey).not.toContain("page.goto(reviewUrl)");
  });
});
