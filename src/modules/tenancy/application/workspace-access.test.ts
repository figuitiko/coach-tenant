import { describe, expect, it } from "vitest";
import {
  authorizeWorkspaceList,
  CrossTenantAccessError,
  resolveWorkspaceAccess,
  selectWorkspaceEntry,
  UnauthenticatedError,
  type WorkspaceMembershipDto,
} from "./workspace-access";

const memberships: WorkspaceMembershipDto[] = [
  { workspaceId: "w-1", workspaceSlug: "north", workspaceName: "North", timeZone: "America/Mexico_City", role: "COACH", accessMode: "MEMBERSHIP" },
  { workspaceId: "w-2", workspaceSlug: "south", workspaceName: "South", timeZone: "America/New_York", role: "STUDENT", accessMode: "MEMBERSHIP" },
];

const adminWorkspaces: WorkspaceMembershipDto[] = memberships.map((workspace) => ({
  ...workspace,
  role: "COACH",
  accessMode: "SUPER_ADMIN",
}));

describe("workspace authorization", () => {
  it("requires an authenticated global user", () => {
    expect(() => resolveWorkspaceAccess(null, "north", memberships)).toThrow(UnauthenticatedError);
  });

  it("returns a tenant DTO when the user belongs to the requested workspace", () => {
    expect(resolveWorkspaceAccess({ userId: "user-1", platformRole: "USER" }, "south", memberships)).toEqual({
      userId: "user-1",
      workspace: memberships[1],
      platformRole: "USER",
    });
  });

  it("denies cross-tenant access", () => {
    expect(() => resolveWorkspaceAccess({ userId: "user-1", platformRole: "USER" }, "east", memberships)).toThrow(
      CrossTenantAccessError,
    );
  });

  it("lets a super admin enter every explicit admin workspace without tenant memberships", () => {
    expect(resolveWorkspaceAccess(
      { userId: "admin-1", platformRole: "SUPER_ADMIN" },
      "south",
      adminWorkspaces,
    )).toEqual({ userId: "admin-1", platformRole: "SUPER_ADMIN", workspace: adminWorkspaces[1] });
  });

  it("does not allow membership data to escalate an ordinary user", () => {
    expect(() => resolveWorkspaceAccess(
      { userId: "user-1", platformRole: "USER" },
      "south",
      adminWorkspaces,
    )).toThrow(CrossTenantAccessError);
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

describe("workspace listing", () => {
  it("shows every workspace to a super admin in explicit admin context", () => {
    expect(authorizeWorkspaceList("SUPER_ADMIN", [], memberships)).toEqual(adminWorkspaces);
  });

  it("keeps north and south coaches isolated to their own memberships", () => {
    expect(authorizeWorkspaceList("USER", [memberships[0]], memberships)).toEqual([memberships[0]]);
    expect(authorizeWorkspaceList("USER", [memberships[1]], memberships)).toEqual([memberships[1]]);
  });

  it("does not change ordinary student membership rules", () => {
    expect(authorizeWorkspaceList("USER", memberships, [])).toEqual(memberships);
  });
});
