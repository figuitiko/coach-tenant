import type { WorkspaceMembershipDto } from "@/modules/tenancy/application/workspace-access";
import type { PrismaClient } from "@/generated/prisma/client";

export class PrismaWorkspaceRepository {
  constructor(private readonly database: PrismaClient) {}

  async listMemberships(userId: string): Promise<WorkspaceMembershipDto[]> {
    const records = await this.database.membership.findMany({
      where: { userId },
      orderBy: { workspace: { name: "asc" } },
      select: {
        workspaceId: true,
        role: true,
        workspace: { select: { slug: true, name: true, timeZone: true } },
      },
    });
    return records.map((record) => ({
      workspaceId: record.workspaceId,
      workspaceSlug: record.workspace.slug,
      workspaceName: record.workspace.name,
      timeZone: record.workspace.timeZone,
      role: record.role,
    }));
  }
}
