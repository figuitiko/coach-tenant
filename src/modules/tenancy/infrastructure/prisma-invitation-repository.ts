import { CrossTenantAccessError } from "@/modules/tenancy/application/workspace-access";
import type { CreateInvitationRecordInput, InvitationRepository } from "@/modules/tenancy/application/invitation-service";
import { InvitationUnavailableError } from "@/modules/tenancy/domain/invitation";
import type { PrismaClient } from "@/generated/prisma/client";

export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly database: PrismaClient) {}

  async createStudentInvitation(input: CreateInvitationRecordInput) {
    return this.database.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.findFirst({
        where: {
          slug: input.workspaceSlug,
          ownerId: input.actorId,
          memberships: { some: { userId: input.actorId, role: "COACH" } },
        },
        select: { id: true },
      });
      if (!workspace) throw new CrossTenantAccessError("Workspace access denied");

      const invitation = await transaction.invitation.create({
        data: {
          workspaceId: workspace.id,
          invitedById: input.actorId,
          tokenHash: input.tokenHash,
          role: "STUDENT",
          expiresAt: input.expiresAt,
          createdAt: input.createdAt,
        },
        select: { id: true, expiresAt: true },
      });
      await transaction.auditEvent.create({ data: {
        workspaceId: workspace.id,
        actorId: input.actorId,
        action: "invitation.created",
        entityType: "Invitation",
        entityId: invitation.id,
      } });
      await transaction.productEvent.create({ data: {
        workspaceId: workspace.id,
        userId: input.actorId,
        name: "invitation_created",
        properties: { invitationId: invitation.id },
      } });
      return invitation;
    });
  }

  async acceptStudentInvitation(input: { userId: string; tokenHash: string; acceptedAt: Date }) {
    return this.database.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: { tokenHash: input.tokenHash },
        select: { id: true, workspaceId: true, role: true, workspace: { select: { slug: true } } },
      });
      if (!invitation || invitation.role !== "STUDENT") throw new InvitationUnavailableError();

      const consumed = await transaction.invitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: input.acceptedAt },
        },
        data: { acceptedAt: input.acceptedAt, acceptedById: input.userId },
      });
      if (consumed.count !== 1) throw new InvitationUnavailableError();

      await transaction.membership.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: input.userId } },
        create: { workspaceId: invitation.workspaceId, userId: input.userId, role: "STUDENT" },
        update: {},
      });
      await transaction.auditEvent.create({ data: {
        workspaceId: invitation.workspaceId,
        actorId: input.userId,
        action: "invitation.accepted",
        entityType: "Invitation",
        entityId: invitation.id,
      } });
      await transaction.productEvent.create({ data: {
        workspaceId: invitation.workspaceId,
        userId: input.userId,
        name: "invitation_accepted",
        properties: { invitationId: invitation.id },
      } });
      return { workspaceSlug: invitation.workspace.slug };
    }, { isolationLevel: "Serializable" });
  }

  async revokeInvitation(input: { actorId: string; invitationId: string; revokedAt: Date }) {
    await this.database.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findFirst({
        where: { id: input.invitationId, workspace: { ownerId: input.actorId } },
        select: { id: true, workspaceId: true },
      });
      if (!invitation) throw new CrossTenantAccessError("Workspace access denied");
      const revoked = await transaction.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: input.revokedAt },
      });
      if (revoked.count !== 1) throw new InvitationUnavailableError();
      await transaction.auditEvent.create({ data: {
        workspaceId: invitation.workspaceId,
        actorId: input.actorId,
        action: "invitation.revoked",
        entityType: "Invitation",
        entityId: invitation.id,
      } });
    });
  }
}
