import { describe, expect, it } from "vitest";
import { isWorkspaceRoleAuthorized } from "./workspace-role-authorization";

function database({ member = false, superAdmin = false } = {}) {
  return {
    membership: { findFirst: async () => member ? { id: "membership" } : null },
    user: { findFirst: async () => superAdmin ? { id: "admin" } : null },
  };
}

describe("database-backed workspace role authorization", () => {
  it("accepts an ordinary tenant membership", async () => {
    await expect(isWorkspaceRoleAuthorized(database({ member: true }), "north", "coach", "COACH")).resolves.toBe(true);
  });

  it("accepts a platform super admin for coach operations without a synthetic membership", async () => {
    await expect(isWorkspaceRoleAuthorized(database({ superAdmin: true }), "south", "admin", "COACH")).resolves.toBe(true);
  });

  it("never turns platform privilege into a student identity", async () => {
    await expect(isWorkspaceRoleAuthorized(database({ superAdmin: true }), "south", "admin", "STUDENT")).resolves.toBe(false);
  });

  it("denies ordinary users without the requested tenant membership", async () => {
    await expect(isWorkspaceRoleAuthorized(database(), "south", "north-coach", "COACH")).resolves.toBe(false);
  });
});
