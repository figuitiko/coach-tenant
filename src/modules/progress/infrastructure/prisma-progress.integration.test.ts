import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ProgressAccessDeniedError, ProgressService } from "../application/progress-service";
import { PrismaProgressRepository } from "./prisma-progress-repository";

const connectionString = process.env.TEST_DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const service = new ProgressService(new PrismaProgressRepository(prisma), () => new Date("2026-08-19T12:00:00Z"));

describe("PrismaProgressRepository PostgreSQL boundaries", () => {
  beforeEach(async () => {
    await prisma.reviewNote.deleteMany(); await prisma.progressPhoto.deleteMany(); await prisma.measurementCheckIn.deleteMany();
    await prisma.setLog.deleteMany(); await prisma.exerciseLog.deleteMany(); await prisma.workoutSession.deleteMany(); await prisma.assignedExercise.deleteMany(); await prisma.assignedWorkout.deleteMany(); await prisma.studentPlanAssignment.deleteMany(); await prisma.planWorkout.deleteMany(); await prisma.workoutPlan.deleteMany(); await prisma.templateExercise.deleteMany(); await prisma.workoutTemplate.deleteMany(); await prisma.exercise.deleteMany();
    await prisma.productEvent.deleteMany(); await prisma.auditEvent.deleteMany(); await prisma.membership.deleteMany(); await prisma.invitation.deleteMany(); await prisma.session.deleteMany(); await prisma.account.deleteMany(); await prisma.workspace.deleteMany(); await prisma.user.deleteMany();
  });
  afterAll(() => prisma.$disconnect());

  it("isolates student drafts, makes submit retry-safe, and emits one event pair", async () => {
    const a = await fixture("a"); const b = await fixture("b");
    const draft = await service.createDraft({ actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" });
    await service.editDraft({ actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" }, { checkInId: draft.id, metrics: { weight: { value: 80, unit: "KG" }, bodyFat: null, chest: null, waist: null, hips: null, arm: null, thigh: null }, notes: "bien" });
    await service.submitDraft({ actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" }, { checkInId: draft.id, idempotencyKey: "same-submit" });
    await service.submitDraft({ actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" }, { checkInId: draft.id, idempotencyKey: "same-submit" });
    await expect(service.submitDraft({ actorId: b.student.id, workspaceId: b.workspace.id, role: "STUDENT" }, { checkInId: draft.id, idempotencyKey: "guess" })).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    expect(await prisma.auditEvent.count({ where: { action: "measurement_check_in.submitted" } })).toBe(1);
    expect(await prisma.productEvent.count({ where: { name: "measurement_check_in_submitted" } })).toBe(1);
  });

  it("keeps coach review queue tenant-scoped and review completion idempotent", async () => {
    const a = await fixture("a"); const b = await fixture("b");
    const draft = await service.createDraft({ actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" });
    await service.submitDraft({ actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" }, { checkInId: draft.id, idempotencyKey: "submit-a" });
    const queue = await service.getReviewQueue({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" });
    expect(queue).toHaveLength(1);
    await service.completeReview({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" }, { kind: "CHECK_IN", itemId: draft.id, note: "Seguimos", idempotencyKey: "review-a" });
    await service.completeReview({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" }, { kind: "CHECK_IN", itemId: draft.id, note: "Duplicada", idempotencyKey: "review-a" });
    expect(await prisma.reviewNote.count()).toBe(1);
    await expect(service.getReviewDetail({ actorId: b.coach.id, workspaceId: b.workspace.id, role: "COACH" }, "CHECK_IN", draft.id)).rejects.toBeInstanceOf(ProgressAccessDeniedError);
  });

  it("converges concurrent draft, attachment, and review retries to one record each", async () => {
    const a = await fixture("concurrent"); const actor = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const drafts = await Promise.all(Array.from({ length: 4 }, () => service.createDraft(actor)));
    expect(new Set(drafts.map(item => item.id)).size).toBe(1);
    const draft = drafts[0];
    const intent = await service.reserveUploadIntent(actor, { checkInId: draft.id, idempotencyKey: "concurrent-upload", objectKey: `workspaces/${a.workspace.id}/students/${a.student.id}/progress/a.jpg`, mimeType: "image/jpeg", sizeBytes: 42, expiresAt: new Date("2026-08-19T12:05:00Z") });
    await Promise.all(Array.from({ length: 4 }, () => service.attachPhoto(actor, { uploadIntentId: intent.id })));
    expect(await prisma.progressPhoto.count()).toBe(1);
    await service.submitDraft(actor, { checkInId: draft.id, idempotencyKey: "submit-concurrent" });
    const coachActor = { actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" as const };
    await Promise.all(Array.from({ length: 4 }, () => service.completeReview(coachActor, { kind: "CHECK_IN", itemId: draft.id, note: "Bien", idempotencyKey: "review-concurrent" })));
    expect(await prisma.reviewNote.count()).toBe(1);
  });
});

async function fixture(suffix: string) {
  const coach = await prisma.user.create({ data: { name: `Coach ${suffix}`, email: `coach-${suffix}@test.local` } });
  const student = await prisma.user.create({ data: { name: `Student ${suffix}`, email: `student-${suffix}@test.local` } });
  const workspace = await prisma.workspace.create({ data: { name: `Workspace ${suffix}`, slug: `workspace-${suffix}`, ownerId: coach.id } });
  await prisma.membership.createMany({ data: [{ workspaceId: workspace.id, userId: coach.id, role: "COACH" }, { workspaceId: workspace.id, userId: student.id, role: "STUDENT" }] });
  return { coach, student, workspace };
}
