import { describe, expect, it } from "vitest";
import { ProgressAccessDeniedError, ProgressService, ProgressValidationError, type ProgressActor, type ProgressRepository } from "./progress-service";

const student = { actorId: "student-a", workspaceId: "workspace-a", role: "STUDENT" } satisfies ProgressActor;
const coach = { actorId: "coach-a", workspaceId: "workspace-a", role: "COACH" } satisfies ProgressActor;

function repository(): ProgressRepository & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { create: [], edit: [], submit: [], intent: [], attach: [], review: [] };
  return {
    calls,
    createDraft: async (input) => (calls.create.push(input), { id: "check-1", status: "DRAFT" }),
    editDraft: async (input) => (calls.edit.push(input), input.checkInId === "other" ? null : { id: input.checkInId, status: "DRAFT" }),
    submitDraft: async (input) => (calls.submit.push(input), input.checkInId === "other" ? null : { id: input.checkInId, status: "SUBMITTED" }),
    reserveUploadIntent: async (input) => (calls.intent.push(input), input.checkInId === "other" ? null : { id: "intent-1", objectKey: input.objectKey, mimeType: input.mimeType, sizeBytes: input.sizeBytes, checksumSha256: input.checksumSha256, expiresAt: input.expiresAt, status: "PENDING" }),
    getUploadIntent: async (input) => input.uploadIntentId === "intent-1" ? { id: "intent-1", objectKey: "key", mimeType: "image/jpeg", sizeBytes: 42, checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", expiresAt: new Date(Date.now() + 60_000), status: "PENDING" } : null,
    attachPhoto: async (input) => (calls.attach.push(input), input.uploadIntentId === "forged" ? null : { id: "photo-1" }),
    listStudentHistory: async (input) => input.studentId === student.actorId ? [] : null,
    getStudentProgress: async (input) => input.studentId === student.actorId ? { draft: null, history: [] } : null,
    getStudentPhoto: async (input) => input.photoId === "mine" && input.studentId === student.actorId ? { objectKey: "workspace-a/student-a/photo.jpg", studentId: "student-a", mimeType: "image/jpeg", sizeBytes: 20 } : null,
    getCoachPhoto: async () => null,
    listReviewQueue: async () => [{ kind: "CHECK_IN", id: "check-1", studentId: "student-a", studentName: "Ana", submittedAt: new Date() }],
    getReviewDetail: async (input) => input.itemId === "cross-tenant" ? null : { kind: input.kind, id: input.itemId, studentId: "student-a", studentName: "Ana", reviewStatus: "PENDING", details: [], photos: [], notes: [] },
    completeReview: async (input) => (calls.review.push(input), input.itemId === "cross-tenant" ? null : { id: "note-1", reviewed: true }),
  };
}

const validMetrics = {
  weight: { value: 82.5, unit: "KG" as const },
  bodyFat: { value: 18, unit: "PERCENT" as const },
  chest: { value: 102, unit: "CM" as const },
  waist: null,
  hips: null,
  arm: null,
  thigh: null,
};

describe("ProgressService", () => {
  it("validates metric values and explicit units before editing a draft", async () => {
    const service = new ProgressService(repository());
    await expect(service.editDraft(student, { checkInId: "check-1", metrics: { ...validMetrics, bodyFat: { value: 101, unit: "PERCENT" } }, notes: null })).rejects.toBeInstanceOf(ProgressValidationError);
    await expect(service.editDraft(student, { checkInId: "check-1", metrics: { ...validMetrics, chest: { value: 100, unit: "KG" as never } }, notes: null })).rejects.toBeInstanceOf(ProgressValidationError);
  });

  it("creates, edits, and submits only the student's own draft with an idempotency key", async () => {
    const repo = repository();
    const service = new ProgressService(repo);
    await service.createDraft(student);
    await service.editDraft(student, { checkInId: "check-1", metrics: validMetrics, notes: "Semana sólida" });
    await service.submitDraft(student, { checkInId: "check-1", idempotencyKey: "submit-1" });
    expect(repo.calls.submit).toEqual([{ workspaceId: "workspace-a", studentId: "student-a", checkInId: "check-1", idempotencyKey: "submit-1", submittedAt: expect.any(Date) }]);
    await expect(service.submitDraft(student, { checkInId: "other", idempotencyKey: "guessed" })).rejects.toBeInstanceOf(ProgressAccessDeniedError);
  });

  it("denies students guessed photo IDs and coach resources outside their workspace", async () => {
    const service = new ProgressService(repository());
    await expect(service.getPhotoDownload(student, "guessed")).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    await expect(service.getReviewDetail(coach, "CHECK_IN", "cross-tenant")).rejects.toBeInstanceOf(ProgressAccessDeniedError);
  });

  it("returns submitted check-ins and completed workouts needing review, and reviews idempotently", async () => {
    const repo = repository();
    const service = new ProgressService(repo);
    expect(await service.getReviewQueue(coach)).toEqual([expect.objectContaining({ kind: "CHECK_IN", id: "check-1" })]);
    await service.completeReview(coach, { kind: "WORKOUT", itemId: "workout-1", note: "Buen control", idempotencyKey: "review-1" });
    expect(repo.calls.review).toEqual([expect.objectContaining({ workspaceId: "workspace-a", coachId: "coach-a", idempotencyKey: "review-1" })]);
  });

  it("reserves an idempotent upload intent and attaches only by its persisted identity", async () => {
    const repo = repository(); const service = new ProgressService(repo);
    await service.reserveUploadIntent(student, { checkInId: "check-1", idempotencyKey: "upload-1", objectKey: "workspaces/workspace-a/students/student-a/progress/a.jpg", mimeType: "image/jpeg", sizeBytes: 42, checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", expiresAt: new Date(Date.now() + 60_000) });
    await service.attachPhoto(student, { uploadIntentId: "intent-1" });
    await expect(service.attachPhoto(student, { uploadIntentId: "forged" })).rejects.toBeInstanceOf(ProgressAccessDeniedError);
    expect(repo.calls.attach).toEqual([{ workspaceId: "workspace-a", studentId: "student-a", uploadIntentId: "intent-1", attachedAt: expect.any(Date) }, { workspaceId: "workspace-a", studentId: "student-a", uploadIntentId: "forged", attachedAt: expect.any(Date) }]);
  });
});
