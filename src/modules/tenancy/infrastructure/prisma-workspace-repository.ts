import { authorizeWorkspaceList, type PlatformRole, type WorkspaceMembershipDto } from "@/modules/tenancy/application/workspace-access";
import type { PrismaClient } from "@/generated/prisma/client";

export class PrismaWorkspaceRepository {
  constructor(private readonly database: PrismaClient) {}

  async listAccessContext(userId: string): Promise<{ platformRole: PlatformRole; memberships: WorkspaceMembershipDto[] }> {
    const user = await this.database.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
    const platformRole = user?.platformRole ?? "USER";
    const records = await this.database.membership.findMany({
      where: { userId },
      orderBy: { workspace: { name: "asc" } },
      select: {
        workspaceId: true,
        role: true,
        workspace: { select: { slug: true, name: true, timeZone: true } },
      },
    });
    const memberships = records.map((record) => ({
      workspaceId: record.workspaceId,
      workspaceSlug: record.workspace.slug,
      workspaceName: record.workspace.name,
      timeZone: record.workspace.timeZone,
      role: record.role,
      accessMode: "MEMBERSHIP" as const,
    }));
    const workspaces = platformRole === "SUPER_ADMIN"
      ? await this.database.workspace.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, timeZone: true } })
      : [];
    return {
      platformRole,
      memberships: authorizeWorkspaceList(platformRole, memberships, workspaces.map((workspace) => ({
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        timeZone: workspace.timeZone,
      }))),
    };
  }
}
