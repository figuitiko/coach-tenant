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
    await prisma.reviewReply.deleteMany(); await prisma.reviewNote.deleteMany(); await prisma.progressPhoto.deleteMany(); await prisma.measurementCheckIn.deleteMany();
    await prisma.setLog.deleteMany(); await prisma.exerciseLog.deleteMany(); await prisma.workoutSession.deleteMany(); await prisma.assignedExercise.deleteMany(); await prisma.assignedWorkout.deleteMany(); await prisma.studentPlanAssignment.deleteMany(); await prisma.planWorkout.deleteMany(); await prisma.workoutPlan.deleteMany(); await prisma.templateExercise.deleteMany(); await prisma.workoutTemplate.deleteMany(); await prisma.exercise.deleteMany();
    await prisma.productEvent.deleteMany(); await prisma.auditEvent.deleteMany(); await prisma.membership.deleteMany(); await prisma.invitation.deleteMany(); await prisma.session.deleteMany(); await prisma.account.deleteMany(); await prisma.workspace.deleteMany(); await prisma.user.deleteMany();
  });
  afterAll(() => prisma.$disconnect());

  it("submits the current metric fields and notes in the same transaction", async () => {
    const a = await fixture("current-submit");
    const actor = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const draft = await service.createDraft(actor);
    await service.editDraft(actor, { checkInId: draft.id, metrics: emptyMetrics(), notes: "stale draft" });

    await service.submitCurrentDraft(actor, {
      checkInId: draft.id,
      metrics: { ...emptyMetrics(), weight: { value: 68.2, unit: "KG" } },
      notes: "current typed values",
      idempotencyKey: "current-submit",
    });

    const persisted = await prisma.measurementCheckIn.findUniqueOrThrow({ where: { id: draft.id } });
    expect(persisted).toMatchObject({ status: "SUBMITTED", weight: 68.2, weightUnit: "KG", notes: "current typed values" });
  });

  it("binds one contextual reply to the reviewed target and owning student", async () => {
    const a = await fixture("reply-owner"); const b = await fixture("reply-other");
    const student = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const draft = await service.createDraft(student);
    await service.submitCurrentDraft(student, { checkInId: draft.id, metrics: emptyMetrics(), notes: "ready", idempotencyKey: "reply-submit" });
    await service.completeReview({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" }, { kind: "CHECK_IN", itemId: draft.id, note: "Keep going", idempotencyKey: "reply-review" });
    const note = await prisma.reviewNote.findFirstOrThrow({ where: { checkInId: draft.id } });

    await service.replyToReview(student, { reviewNoteId: note.id, body: "Understood" });
    await service.replyToReview(student, { reviewNoteId: note.id, body: "Understood" });
    expect(await prisma.reviewReply.count({ where: { reviewNoteId: note.id } })).toBe(1);
    await expect(service.replyToReview({ actorId: b.student.id, workspaceId: b.workspace.id, role: "STUDENT" }, { reviewNoteId: note.id, body: "guessed" })).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    await expect(service.replyToReview({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" }, { reviewNoteId: note.id, body: "coach reply" })).rejects.toBeInstanceOf(ProgressAccessDeniedError);

    const detail = await service.getReviewDetail({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" }, "CHECK_IN", draft.id);
    expect(detail.notes[0].reply?.body).toBe("Understood");
  });

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
    await expect(service.completeReview({ actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" }, { kind: "CHECK_IN", itemId: draft.id, note: "Duplicada", idempotencyKey: "review-a" })).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    expect(await prisma.reviewNote.count()).toBe(1);
    await expect(service.getReviewDetail({ actorId: b.coach.id, workspaceId: b.workspace.id, role: "COACH" }, "CHECK_IN", draft.id)).rejects.toBeInstanceOf(ProgressAccessDeniedError);
  });

  it("converges concurrent draft, attachment, and review retries to one record each", async () => {
    const a = await fixture("concurrent"); const actor = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const drafts = await Promise.all(Array.from({ length: 4 }, () => service.createDraft(actor)));
    expect(new Set(drafts.map(item => item.id)).size).toBe(1);
    const draft = drafts[0];
    const intent = await service.reserveUploadIntent(actor, { checkInId: draft.id, idempotencyKey: "concurrent-upload", objectKey: `workspaces/${a.workspace.id}/students/${a.student.id}/progress/a.jpg`, mimeType: "image/jpeg", sizeBytes: 42, checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", expiresAt: new Date("2026-08-19T12:05:00Z") });
    await Promise.all(Array.from({ length: 4 }, () => service.attachPhoto(actor, { uploadIntentId: intent.id })));
    expect(await prisma.progressPhoto.count()).toBe(1);
    await service.submitDraft(actor, { checkInId: draft.id, idempotencyKey: "submit-concurrent" });
    const coachActor = { actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" as const };
    await Promise.all(Array.from({ length: 4 }, () => service.completeReview(coachActor, { kind: "CHECK_IN", itemId: draft.id, note: "Bien", idempotencyKey: "review-concurrent" })));
    expect(await prisma.reviewNote.count()).toBe(1);
  });

  it("allows exactly one of two conflicting concurrent submit keys and preserves the winner", async () => {
    const a = await fixture("submit-race"); const actor = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const draft = await service.createDraft(actor);
    const results = await Promise.allSettled(["submit-one", "submit-two"].map(idempotencyKey => service.submitDraft(actor, { checkInId: draft.id, idempotencyKey })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const persisted = await prisma.measurementCheckIn.findUniqueOrThrow({ where: { id: draft.id } });
    expect(["submit-one", "submit-two"]).toContain(persisted.submitIdempotencyKey);
    const retry = await service.submitDraft(actor, { checkInId: draft.id, idempotencyKey: persisted.submitIdempotencyKey! });
    expect(retry.id).toBe(draft.id);
  });

  it("never lets an edit overwrite a draft after a concurrent submit wins", async () => {
    const a = await fixture("edit-submit-race"); const actor = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const draft = await service.createDraft(actor);
    const edit = () => service.editDraft(actor, { checkInId: draft.id, metrics: { weight: null, bodyFat: null, chest: null, waist: null, hips: null, arm: null, thigh: null }, notes: "late edit" });
    await Promise.allSettled([service.submitDraft(actor, { checkInId: draft.id, idempotencyKey: "submit" }), edit()]);
    await expect(edit()).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    const before = await prisma.measurementCheckIn.findUniqueOrThrow({ where: { id: draft.id } });
    await expect(edit()).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    const after = await prisma.measurementCheckIn.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.notes).toBe(before.notes);
    expect(after.status).toBe("SUBMITTED");
  });

  it("rolls back the losing target when one review key races across two targets", async () => {
    const a = await fixture("review-key-race"); const student = { actorId: a.student.id, workspaceId: a.workspace.id, role: "STUDENT" as const };
    const first = await service.createDraft(student); await service.submitDraft(student, { checkInId: first.id, idempotencyKey: "submit-first" });
    const second = await service.createDraft(student); await service.submitDraft(student, { checkInId: second.id, idempotencyKey: "submit-second" });
    const coach = { actorId: a.coach.id, workspaceId: a.workspace.id, role: "COACH" as const };
    const results = await Promise.allSettled([first.id, second.id].map(itemId => service.completeReview(coach, { kind: "CHECK_IN", itemId, note: "Same semantics", idempotencyKey: "shared-review-key" })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.reviewNote.count({ where: { workspaceId: a.workspace.id, idempotencyKey: "shared-review-key" } })).toBe(1);
    expect(await prisma.measurementCheckIn.count({ where: { id: { in: [first.id, second.id] }, reviewStatus: "REVIEWED" } })).toBe(1);
    expect(await prisma.measurementCheckIn.count({ where: { id: { in: [first.id, second.id] }, reviewStatus: "PENDING" } })).toBe(1);
  });
});

async function fixture(suffix: string) {
  const coach = await prisma.user.create({ data: { name: `Coach ${suffix}`, email: `coach-${suffix}@test.local` } });
  const student = await prisma.user.create({ data: { name: `Student ${suffix}`, email: `student-${suffix}@test.local` } });
  const workspace = await prisma.workspace.create({ data: { name: `Workspace ${suffix}`, slug: `workspace-${suffix}`, ownerId: coach.id } });
  await prisma.membership.createMany({ data: [{ workspaceId: workspace.id, userId: coach.id, role: "COACH" }, { workspaceId: workspace.id, userId: student.id, role: "STUDENT" }] });
  return { coach, student, workspace };
}

function emptyMetrics() {
  return { weight: null, bodyFat: null, chest: null, waist: null, hips: null, arm: null, thigh: null };
}
