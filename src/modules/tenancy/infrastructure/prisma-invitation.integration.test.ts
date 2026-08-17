import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { InvitationService } from "@/modules/tenancy/application/invitation-service";
import { InvitationUnavailableError } from "@/modules/tenancy/domain/invitation";
import { PrismaInvitationRepository } from "./prisma-invitation-repository";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

integration("PrismaInvitationRepository against PostgreSQL", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const repository = new PrismaInvitationRepository(database);
  const service = new InvitationService(repository);
  let coachId: string;
  let studentId: string;
  let workspaceId: string;
  const workspaceSlug = `integration-${Date.now()}`;

  beforeAll(async () => {
    const coach = await database.user.create({ data: { name: "Coach Test", email: `${workspaceSlug}-coach@example.test` } });
    const student = await database.user.create({ data: { name: "Student Test", email: `${workspaceSlug}-student@example.test` } });
    const workspace = await database.workspace.create({ data: { slug: workspaceSlug, name: "Integration", ownerId: coach.id } });
    await database.membership.create({ data: { workspaceId: workspace.id, userId: coach.id, role: "COACH" } });
    coachId = coach.id;
    studentId = student.id;
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    if (workspaceId) await database.workspace.delete({ where: { id: workspaceId } });
    if (coachId && studentId) await database.user.deleteMany({ where: { id: { in: [coachId, studentId] } } });
    await database.$disconnect();
  });

  it("atomically consumes once, avoids duplicate membership, and records events", async () => {
    const issued = await service.create({ actorId: coachId, workspaceSlug, expiresAt: new Date(Date.now() + 60_000) });
    await service.accept({ userId: studentId, rawToken: issued.rawToken });

    expect(await database.membership.count({ where: { workspaceId, userId: studentId } })).toBe(1);
    expect(await database.auditEvent.count({ where: { workspaceId, action: "invitation.accepted" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "invitation_accepted" } })).toBe(1);
    await expect(service.accept({ userId: studentId, rawToken: issued.rawToken })).rejects.toBeInstanceOf(InvitationUnavailableError);
  });

  it("rejects revoked and expired tokens", async () => {
    const revoked = await service.create({ actorId: coachId, workspaceSlug, expiresAt: new Date(Date.now() + 60_000) });
    await service.revoke({ actorId: coachId, invitationId: revoked.id });
    await expect(service.accept({ userId: studentId, rawToken: revoked.rawToken })).rejects.toBeInstanceOf(InvitationUnavailableError);

    const tokenHash = "expired".repeat(9).slice(0, 64);
    await database.invitation.create({ data: {
      workspaceId,
      invitedById: coachId,
      tokenHash,
      role: "STUDENT",
      expiresAt: new Date(Date.now() - 1_000),
    } });
    await expect(repository.acceptStudentInvitation({ userId: studentId, tokenHash, acceptedAt: new Date() })).rejects.toBeInstanceOf(InvitationUnavailableError);
  });
});
