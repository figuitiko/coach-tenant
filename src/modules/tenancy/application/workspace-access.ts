export type MembershipRole = "COACH" | "STUDENT";

export type WorkspaceMembershipDto = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  timeZone: string;
  role: MembershipRole;
};

export type SessionIdentity = { userId: string };

export class UnauthenticatedError extends Error {}
export class CrossTenantAccessError extends Error {}

export function resolveWorkspaceAccess(
  session: SessionIdentity | null,
  workspaceSlug: string,
  memberships: readonly WorkspaceMembershipDto[],
) {
  if (!session) throw new UnauthenticatedError("Authentication required");
  const workspace = memberships.find((membership) => membership.workspaceSlug === workspaceSlug);
  if (!workspace) throw new CrossTenantAccessError("Workspace access denied");
  return { userId: session.userId, workspace };
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
