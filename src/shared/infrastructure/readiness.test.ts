import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "./readiness";

describe("readiness", () => {
  it("reports ready without exposing configuration values", async () => {
    const result = await evaluateReadiness(async () => undefined);
    expect(result).toEqual({ status: "ready", checks: { database: "up" } });
    expect(JSON.stringify(result)).not.toContain("postgresql://");
  });

  it("fails closed with a generic database state", async () => {
    const result = await evaluateReadiness(async () => { throw new Error("postgresql://secret"); });
    expect(result).toEqual({ status: "not_ready", checks: { database: "down" } });
  });
});
