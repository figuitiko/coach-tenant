export type MembershipRole = "COACH" | "STUDENT";
export type PlatformRole = "USER" | "SUPER_ADMIN";
export type WorkspaceAccessMode = "MEMBERSHIP" | "SUPER_ADMIN";

export type WorkspaceMembershipDto = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  timeZone: string;
  role: MembershipRole;
  accessMode?: WorkspaceAccessMode;
};

export type SessionIdentity = { userId: string; platformRole?: PlatformRole };

export class UnauthenticatedError extends Error {}
export class CrossTenantAccessError extends Error {}

export function resolveWorkspaceAccess(
  session: SessionIdentity | null,
  workspaceSlug: string,
  memberships: readonly WorkspaceMembershipDto[],
) {
  if (!session) throw new UnauthenticatedError("Authentication required");
  const workspace = memberships.find((membership) => membership.workspaceSlug === workspaceSlug);
  if (!workspace || (workspace.accessMode === "SUPER_ADMIN" && session.platformRole !== "SUPER_ADMIN")) {
    throw new CrossTenantAccessError("Workspace access denied");
  }
  return { userId: session.userId, platformRole: session.platformRole ?? "USER", workspace };
}

export function authorizeWorkspaceList(
  platformRole: PlatformRole,
  memberships: readonly WorkspaceMembershipDto[],
  allWorkspaces: readonly Omit<WorkspaceMembershipDto, "role" | "accessMode">[],
): WorkspaceMembershipDto[] {
  if (platformRole === "SUPER_ADMIN") {
    return allWorkspaces.map((workspace) => ({ ...workspace, role: "COACH", accessMode: "SUPER_ADMIN" }));
  }
  return memberships.filter((workspace) => workspace.accessMode !== "SUPER_ADMIN");
}

export function selectWorkspaceEntry(
  memberships: readonly WorkspaceMembershipDto[],
  preferredSlug?: string,
) {
  if (preferredSlug && memberships.some((membership) => membership.workspaceSlug === preferredSlug)) {
    return `/w/${preferredSlug}`;
  }
  return memberships.length === 1 ? `/w/${memberships[0].workspaceSlug}` : null;
}
