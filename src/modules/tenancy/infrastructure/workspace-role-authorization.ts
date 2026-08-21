import type { MembershipRole } from "@/modules/tenancy/application/workspace-access";

type AuthorizationDatabase = {
  membership: { findFirst(input: object): Promise<{ id: string } | null> };
  user: { findFirst(input: object): Promise<{ id: string } | null> };
};

export async function isWorkspaceRoleAuthorized(
  database: AuthorizationDatabase,
  workspaceId: string,
  userId: string,
  role: MembershipRole,
) {
  const membership = await database.membership.findFirst({
    where: { workspaceId, userId, role },
    select: { id: true },
  });
  if (membership) return true;
  if (role !== "COACH") return false;
  const superAdmin = await database.user.findFirst({
    where: { id: userId, platformRole: "SUPER_ADMIN" },
    select: { id: true },
  });
  return Boolean(superAdmin);
}
