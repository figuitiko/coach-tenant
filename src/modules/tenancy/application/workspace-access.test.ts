import { describe, expect, it } from "vitest";
import {
  CrossTenantAccessError,
  resolveWorkspaceAccess,
  selectWorkspaceEntry,
  UnauthenticatedError,
  type WorkspaceMembershipDto,
} from "./workspace-access";

const memberships: WorkspaceMembershipDto[] = [
  { workspaceId: "w-1", workspaceSlug: "north", workspaceName: "North", timeZone: "America/Mexico_City", role: "COACH" },
  { workspaceId: "w-2", workspaceSlug: "south", workspaceName: "South", timeZone: "America/New_York", role: "STUDENT" },
];

describe("workspace authorization", () => {
  it("requires an authenticated global user", () => {
    expect(() => resolveWorkspaceAccess(null, "north", memberships)).toThrow(UnauthenticatedError);
  });

  it("returns a tenant DTO when the user belongs to the requested workspace", () => {
    expect(resolveWorkspaceAccess({ userId: "user-1" }, "south", memberships)).toEqual({
      userId: "user-1",
      workspace: memberships[1],
    });
  });

  it("denies cross-tenant access", () => {
    expect(() => resolveWorkspaceAccess({ userId: "user-1" }, "east", memberships)).toThrow(
      CrossTenantAccessError,
    );
  });
});

describe("workspace entry selection", () => {
  it("routes a single-membership user directly", () => {
    expect(selectWorkspaceEntry([memberships[0]])).toBe("/w/north");
  });

  it("requires an explicit choice for a multi-membership user", () => {
    expect(selectWorkspaceEntry(memberships)).toBeNull();
  });

  it("honors an accessible preferred workspace", () => {
    expect(selectWorkspaceEntry(memberships, "south")).toBe("/w/south");
  });
});
