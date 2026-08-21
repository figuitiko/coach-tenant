import type { PrismaClient } from "@/generated/prisma/client";
import { isWorkspaceRoleAuthorized } from "@/modules/tenancy/infrastructure/workspace-role-authorization";
import { ProgressAccessDeniedError, type CheckInMetrics, type ProgressRepository, type ReviewDetail, type ReviewHistoryItem, type ReviewKind, type ReviewQueueItem } from "../application/progress-service";

export class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly db: PrismaClient) {}

  async createDraft(input: { workspaceId: string; studentId: string; createdAt: Date }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      await tx.measurementCheckIn.createMany({ data: [{ ...input, draftSlot: "ACTIVE" }], skipDuplicates: true });
      return tx.measurementCheckIn.findUniqueOrThrow({ where: { workspaceId_studentId_draftSlot: { workspaceId: input.workspaceId, studentId: input.studentId, draftSlot: "ACTIVE" } }, select: { id: true, status: true } }) as Promise<{ id: string; status: "DRAFT" }>;
    });
  }

  async editDraft(input: { workspaceId: string; studentId: string; checkInId: string; metrics: CheckInMetrics; notes: string | null }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const values = metricData(input.metrics);
      const edited = await tx.measurementCheckIn.updateMany({ where: { id: input.checkInId, workspaceId: input.workspaceId, studentId: input.studentId, status: "DRAFT" }, data: { ...values, notes: input.notes } });
      return edited.count === 1 ? { id: input.checkInId, status: "DRAFT" as const } : null;
    });
  }

  async submitDraft(input: { workspaceId: string; studentId: string; checkInId: string; idempotencyKey: string; submittedAt: Date }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const submitted = await tx.measurementCheckIn.updateMany({ where: { id: input.checkInId, workspaceId: input.workspaceId, studentId: input.studentId, status: "DRAFT" }, data: { status: "SUBMITTED", draftSlot: null, submittedAt: input.submittedAt, submitIdempotencyKey: input.idempotencyKey } });
      if (submitted.count === 1) {
        await eventPair(tx, input.workspaceId, input.studentId, "measurement_check_in.submitted", "measurement_check_in_submitted", "MeasurementCheckIn", input.checkInId, `checkin-submit:${input.checkInId}`);
        return { id: input.checkInId, status: "SUBMITTED" as const };
      }
      const existing = await tx.measurementCheckIn.findFirst({ where: { id: input.checkInId, workspaceId: input.workspaceId, studentId: input.studentId, status: { in: ["SUBMITTED", "REVIEWED"] }, submitIdempotencyKey: input.idempotencyKey }, select: { id: true } });
      return existing ? { id: existing.id, status: "SUBMITTED" as const } : null;
    });
  }

  async submitCurrentDraft(input: { workspaceId: string; studentId: string; checkInId: string; metrics: CheckInMetrics; notes: string | null; idempotencyKey: string; submittedAt: Date }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const submitted = await tx.measurementCheckIn.updateMany({
        where: { id: input.checkInId, workspaceId: input.workspaceId, studentId: input.studentId, status: "DRAFT" },
        data: { ...metricData(input.metrics), notes: input.notes, status: "SUBMITTED", draftSlot: null, submittedAt: input.submittedAt, submitIdempotencyKey: input.idempotencyKey },
      });
      if (submitted.count === 1) {
        await eventPair(tx, input.workspaceId, input.studentId, "measurement_check_in.submitted", "measurement_check_in_submitted", "MeasurementCheckIn", input.checkInId, `checkin-submit:${input.checkInId}`);
        return { id: input.checkInId, status: "SUBMITTED" as const };
      }
      const existing = await tx.measurementCheckIn.findFirst({ where: { id: input.checkInId, workspaceId: input.workspaceId, studentId: input.studentId, status: { in: ["SUBMITTED", "REVIEWED"] }, submitIdempotencyKey: input.idempotencyKey }, select: { id: true } });
      return existing ? { id: existing.id, status: "SUBMITTED" as const } : null;
    });
  }

  async reserveUploadIntent(input: { workspaceId: string; studentId: string; checkInId: string; idempotencyKey: string; objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string; expiresAt: Date }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const scope = `workspaces/${safeSegment(input.workspaceId)}/students/${safeSegment(input.studentId)}/progress/`;
      if (!input.objectKey.startsWith(scope) || input.objectKey.includes("..")) throw new ProgressAccessDeniedError();
      const checkIn = await tx.measurementCheckIn.findFirst({ where: { id: input.checkInId, workspaceId: input.workspaceId, studentId: input.studentId, status: "DRAFT" }, select: { id: true } });
      if (!checkIn) return null;
      const intent = await tx.photoUploadIntent.upsert({ where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } }, update: {}, create: input });
      if (intent.checkInId !== input.checkInId || intent.studentId !== input.studentId || intent.mimeType !== input.mimeType || intent.sizeBytes !== input.sizeBytes || intent.checksumSha256 !== input.checksumSha256) throw new ProgressAccessDeniedError();
      return { id: intent.id, objectKey: intent.objectKey, mimeType: intent.mimeType, sizeBytes: intent.sizeBytes, checksumSha256: intent.checksumSha256, expiresAt: intent.expiresAt, status: intent.status };
    });
  }

  async attachPhoto(input: { workspaceId: string; studentId: string; uploadIntentId: string; attachedAt: Date }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const ownership = { uploadIntentId: input.uploadIntentId, workspaceId: input.workspaceId, studentId: input.studentId };
      const existing = await tx.progressPhoto.findFirst({ where: ownership, select: { id: true } });
      if (existing) return existing;
      const consumed = await tx.photoUploadIntent.updateMany({ where: { id: input.uploadIntentId, workspaceId: input.workspaceId, studentId: input.studentId, status: "PENDING", expiresAt: { gt: input.attachedAt }, checkIn: { status: "DRAFT" } }, data: { status: "CONSUMED", consumedAt: input.attachedAt } });
      if (consumed.count !== 1) return tx.progressPhoto.findFirst({ where: ownership, select: { id: true } });
      const intent = await tx.photoUploadIntent.findUniqueOrThrow({ where: { id: input.uploadIntentId } });
      const photo = await tx.progressPhoto.create({ data: { workspaceId: intent.workspaceId, studentId: intent.studentId, checkInId: intent.checkInId, objectKey: intent.objectKey, mimeType: intent.mimeType, sizeBytes: intent.sizeBytes, checksumSha256: intent.checksumSha256, idempotencyKey: intent.idempotencyKey, uploadIntentId: intent.id }, select: { id: true } });
      await eventPair(tx, input.workspaceId, input.studentId, "progress_photo.attached", "progress_photo_attached", "ProgressPhoto", photo.id, `photo-attach:${photo.id}`);
      return photo;
    });
  }

  async getUploadIntent(input: { workspaceId: string; studentId: string; uploadIntentId: string }) {
    return this.db.photoUploadIntent.findFirst({ where: { id: input.uploadIntentId, workspaceId: input.workspaceId, studentId: input.studentId }, select: { id: true, objectKey: true, mimeType: true, sizeBytes: true, checksumSha256: true, expiresAt: true, status: true } });
  }

  async listStudentHistory(input: { workspaceId: string; studentId: string }) {
    await requireMember(this.db, input.workspaceId, input.studentId, "STUDENT");
    return this.db.measurementCheckIn.findMany({ where: { workspaceId: input.workspaceId, studentId: input.studentId, status: { not: "DRAFT" } }, orderBy: { submittedAt: "desc" }, include: { photos: { select: { id: true, mimeType: true, sizeBytes: true } }, reviewNotes: { select: { id: true, body: true, createdAt: true, reply: { select: { id: true, body: true, createdAt: true } } } } } });
  }

  async getStudentProgress(input: { workspaceId: string; studentId: string }) {
    await requireMember(this.db, input.workspaceId, input.studentId, "STUDENT");
    const [draft, history] = await Promise.all([
      this.db.measurementCheckIn.findFirst({ where: { workspaceId: input.workspaceId, studentId: input.studentId, status: "DRAFT" }, orderBy: { createdAt: "desc" }, include: { photos: { select: { id: true, mimeType: true, sizeBytes: true } } } }),
      this.db.measurementCheckIn.findMany({ where: { workspaceId: input.workspaceId, studentId: input.studentId, status: { not: "DRAFT" } }, orderBy: { submittedAt: "desc" }, select: { id: true, submittedAt: true, notes: true, reviewNotes: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true, reply: { select: { id: true, body: true, createdAt: true } } } } } }),
    ]);
    return { draft: draft ? { id: draft.id, status: draft.status, metrics: { weight: draft.weight === null ? null : { value: Number(draft.weight), unit: draft.weightUnit }, bodyFat: draft.bodyFat === null ? null : { value: Number(draft.bodyFat), unit: draft.bodyFatUnit }, chest: draft.chest === null ? null : { value: Number(draft.chest), unit: draft.chestUnit }, waist: draft.waist === null ? null : { value: Number(draft.waist), unit: draft.waistUnit }, hips: draft.hips === null ? null : { value: Number(draft.hips), unit: draft.hipsUnit }, arm: draft.arm === null ? null : { value: Number(draft.arm), unit: draft.armUnit }, thigh: draft.thigh === null ? null : { value: Number(draft.thigh), unit: draft.thighUnit } }, notes: draft.notes, photos: draft.photos } : null, history };
  }

  async getStudentPhoto(input: { workspaceId: string; studentId: string; photoId: string }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const photo = await tx.progressPhoto.findFirst({ where: { id: input.photoId, workspaceId: input.workspaceId, studentId: input.studentId }, select: { objectKey: true, studentId: true, mimeType: true, sizeBytes: true } });
      if (!photo) return null;
      await eventPair(tx, input.workspaceId, input.studentId, "progress_photo.accessed", "progress_photo_accessed", "ProgressPhoto", input.photoId, `photo-access:${input.photoId}:${input.studentId}`);
      return photo;
    });
  }

  async getCoachPhoto(input: { workspaceId: string; coachId: string; photoId: string }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.coachId, "COACH");
      const photo = await tx.progressPhoto.findFirst({ where: { id: input.photoId, workspaceId: input.workspaceId }, select: { objectKey: true, studentId: true, mimeType: true, sizeBytes: true } });
      if (!photo) return null;
      await eventPair(tx, input.workspaceId, input.coachId, "progress_photo.accessed", "progress_photo_accessed", "ProgressPhoto", input.photoId, `photo-access:${input.photoId}:${input.coachId}`);
      return photo;
    });
  }

  async listReviewQueue(input: { workspaceId: string; coachId: string }): Promise<ReviewQueueItem[]> {
    await requireMember(this.db, input.workspaceId, input.coachId, "COACH");
    const [checks, workouts] = await Promise.all([
      this.db.measurementCheckIn.findMany({ where: { workspaceId: input.workspaceId, status: "SUBMITTED", reviewStatus: "PENDING" }, select: { id: true, studentId: true, submittedAt: true, student: { select: { name: true } } } }),
      this.db.workoutSession.findMany({ where: { status: "COMPLETED", reviewStatus: "PENDING", assignedWorkout: { workspaceId: input.workspaceId } }, select: { id: true, studentId: true, completedAt: true, student: { select: { name: true } } } }),
    ]);
    return [...checks.map((item) => ({ kind: "CHECK_IN" as const, id: item.id, studentId: item.studentId, studentName: item.student.name, submittedAt: item.submittedAt! })), ...workouts.map((item) => ({ kind: "WORKOUT" as const, id: item.id, studentId: item.studentId, studentName: item.student.name, submittedAt: item.completedAt! }))].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  }

  async listReviewHistory(input: { workspaceId: string; coachId: string }): Promise<ReviewHistoryItem[]> {
    await requireMember(this.db, input.workspaceId, input.coachId, "COACH");
    const select = {
      createdAt: true,
      checkIn: { select: { id: true, studentId: true, reviewedAt: true, student: { select: { name: true } } } },
      workoutSession: { select: { id: true, studentId: true, reviewedAt: true, student: { select: { name: true } } } },
      reply: { select: { body: true, createdAt: true } },
    } as const;
    const [replied, recent] = await Promise.all([
      this.db.reviewNote.findMany({ where: { workspaceId: input.workspaceId, reply: { isNot: null } }, orderBy: { reply: { createdAt: "desc" } }, take: 20, select }),
      this.db.reviewNote.findMany({ where: { workspaceId: input.workspaceId, reply: { is: null } }, orderBy: { createdAt: "desc" }, take: 20, select }),
    ]);
    const notes = [...replied, ...recent];
    return notes.flatMap((note) => {
      const target = note.checkIn ?? note.workoutSession;
      if (!target) return [];
      return [{
        kind: note.checkIn ? "CHECK_IN" as const : "WORKOUT" as const,
        id: target.id,
        studentId: target.studentId,
        studentName: target.student.name,
        reviewedAt: target.reviewedAt ?? note.createdAt,
        reply: note.reply,
      }];
    });
  }

  async getReviewDetail(input: { workspaceId: string; coachId: string; kind: ReviewKind; itemId: string }): Promise<ReviewDetail | null> {
    await requireMember(this.db, input.workspaceId, input.coachId, "COACH");
    if (input.kind === "CHECK_IN") {
      const item = await this.db.measurementCheckIn.findFirst({ where: { id: input.itemId, workspaceId: input.workspaceId, status: { not: "DRAFT" } }, include: { student: { select: { name: true } }, photos: { select: { id: true, mimeType: true } }, reviewNotes: { select: { id: true, body: true, createdAt: true, reply: { select: { id: true, body: true, createdAt: true } } }, orderBy: { createdAt: "asc" } } } });
      return item ? { kind: "CHECK_IN", id: item.id, studentId: item.studentId, studentName: item.student.name, reviewStatus: item.reviewStatus, details: checkInDetails(item), photos: item.photos, notes: item.reviewNotes } : null;
    }
    const item = await this.db.workoutSession.findFirst({ where: { id: input.itemId, status: "COMPLETED", assignedWorkout: { workspaceId: input.workspaceId } }, include: { student: { select: { name: true } }, assignedWorkout: { select: { templateName: true } }, exerciseLogs: { include: { assignedExercise: { select: { exerciseName: true } }, sets: true } }, reviewNotes: { select: { id: true, body: true, createdAt: true, reply: { select: { id: true, body: true, createdAt: true } } }, orderBy: { createdAt: "asc" } } } });
    return item ? { kind: "WORKOUT", id: item.id, studentId: item.studentId, studentName: item.student.name, reviewStatus: item.reviewStatus, details: [{ label: "Sesión", value: item.assignedWorkout.templateName }, ...item.exerciseLogs.map(log => ({ label: log.assignedExercise.exerciseName, value: `${log.sets.filter(set => set.completed).length}/${log.sets.length} series completadas` }))], photos: [], notes: item.reviewNotes } : null;
  }

  async completeReview(input: { workspaceId: string; coachId: string; kind: ReviewKind; itemId: string; note: string; idempotencyKey: string; reviewedAt: Date }) {
    try { return await this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.coachId, "COACH");
      const retry = await tx.reviewNote.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } }, select: { id: true, coachId: true, checkInId: true, workoutSessionId: true, body: true } });
      if (retry) return sameReview(retry, input) ? { id: retry.id, reviewed: true } : null;
      let studentId: string | null = null;
      if (input.kind === "CHECK_IN") {
        const target = await tx.measurementCheckIn.findFirst({ where: { id: input.itemId, workspaceId: input.workspaceId, status: "SUBMITTED", reviewStatus: "PENDING" }, select: { id: true, studentId: true } });
        if (!target) return retryReview(tx, input);
        studentId = target.studentId;
        const changed = await tx.measurementCheckIn.updateMany({ where: { id: target.id, status: "SUBMITTED", reviewStatus: "PENDING" }, data: { reviewStatus: "REVIEWED", status: "REVIEWED", reviewedAt: input.reviewedAt } });
        if (changed.count !== 1) return retryReview(tx, input);
      } else {
        const target = await tx.workoutSession.findFirst({ where: { id: input.itemId, status: "COMPLETED", reviewStatus: "PENDING", assignedWorkout: { workspaceId: input.workspaceId } }, select: { id: true, studentId: true } });
        if (!target) return retryReview(tx, input);
        studentId = target.studentId;
        const changed = await tx.workoutSession.updateMany({ where: { id: target.id, status: "COMPLETED", reviewStatus: "PENDING" }, data: { reviewStatus: "REVIEWED", reviewedAt: input.reviewedAt } });
        if (changed.count !== 1) return retryReview(tx, input);
      }
      const note = await tx.reviewNote.upsert({ where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } }, update: {}, create: { workspaceId: input.workspaceId, coachId: input.coachId, checkInId: input.kind === "CHECK_IN" ? input.itemId : null, workoutSessionId: input.kind === "WORKOUT" ? input.itemId : null, body: input.note, idempotencyKey: input.idempotencyKey }, select: { id: true } });
      const bound = await tx.reviewNote.findUniqueOrThrow({ where: { id: note.id }, select: { id: true, coachId: true, checkInId: true, workoutSessionId: true, body: true } });
      if (!sameReview(bound, input)) throw new ReviewConflict();
      await eventPair(tx, input.workspaceId, input.coachId, "review.completed", "review_completed", input.kind === "CHECK_IN" ? "MeasurementCheckIn" : "WorkoutSession", input.itemId, `review:${input.kind}:${input.itemId}`, { studentId });
      return { id: note.id, reviewed: true };
    }); } catch (error) { if (error instanceof ReviewConflict) return null; throw error; }
  }

  async replyToReview(input: { workspaceId: string; studentId: string; reviewNoteId: string; body: string; createdAt: Date }) {
    return this.db.$transaction(async (tx) => {
      await requireMember(tx, input.workspaceId, input.studentId, "STUDENT");
      const note = await tx.reviewNote.findFirst({ where: {
        id: input.reviewNoteId,
        workspaceId: input.workspaceId,
        OR: [
          { checkIn: { studentId: input.studentId, workspaceId: input.workspaceId } },
          { workoutSession: { studentId: input.studentId, assignedWorkout: { workspaceId: input.workspaceId } } },
        ],
      }, select: { id: true, reply: { select: { id: true, body: true } } } });
      if (!note) return null;
      if (note.reply) return note.reply.body === input.body ? { id: note.reply.id } : null;
      const reply = await tx.reviewReply.create({ data: { workspaceId: input.workspaceId, reviewNoteId: note.id, studentId: input.studentId, body: input.body, createdAt: input.createdAt }, select: { id: true } });
      await eventPair(tx, input.workspaceId, input.studentId, "review.replied", "review_replied", "ReviewNote", note.id, `review-reply:${note.id}`);
      return reply;
    });
  }
}

class ReviewConflict extends Error {}
type ReviewBinding = { coachId: string; checkInId: string | null; workoutSessionId: string | null; body: string };
function sameReview(note: ReviewBinding, input: { coachId: string; kind: ReviewKind; itemId: string; note: string }) { return note.coachId === input.coachId && note.body === input.note && note.checkInId === (input.kind === "CHECK_IN" ? input.itemId : null) && note.workoutSessionId === (input.kind === "WORKOUT" ? input.itemId : null); }
async function retryReview(tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], input: { workspaceId: string; coachId: string; kind: ReviewKind; itemId: string; note: string; idempotencyKey: string }) { const note = await tx.reviewNote.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId: input.workspaceId, idempotencyKey: input.idempotencyKey } }, select: { id: true, coachId: true, checkInId: true, workoutSessionId: true, body: true } }); return note && sameReview(note, input) ? { id: note.id, reviewed: true as const } : null; }

type Db = Pick<PrismaClient, "membership" | "user">;
async function requireMember(db: Db, workspaceId: string, userId: string, role: "COACH" | "STUDENT") { if (!await isWorkspaceRoleAuthorized(db, workspaceId, userId, role)) throw new ProgressAccessDeniedError(); }
function metricData(metrics: CheckInMetrics) { return { weight: metrics.weight?.value ?? null, weightUnit: metrics.weight?.unit ?? null, bodyFat: metrics.bodyFat?.value ?? null, bodyFatUnit: metrics.bodyFat?.unit ?? null, chest: metrics.chest?.value ?? null, chestUnit: metrics.chest?.unit ?? null, waist: metrics.waist?.value ?? null, waistUnit: metrics.waist?.unit ?? null, hips: metrics.hips?.value ?? null, hipsUnit: metrics.hips?.unit ?? null, arm: metrics.arm?.value ?? null, armUnit: metrics.arm?.unit ?? null, thigh: metrics.thigh?.value ?? null, thighUnit: metrics.thigh?.unit ?? null }; }
function safeSegment(value: string) { return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""); }
function checkInDetails(item: { weight: unknown; weightUnit: string | null; bodyFat: unknown; bodyFatUnit: string | null; chest: unknown; chestUnit: string | null; waist: unknown; waistUnit: string | null; hips: unknown; hipsUnit: string | null; arm: unknown; armUnit: string | null; thigh: unknown; thighUnit: string | null; notes: string | null }) { const rows: Array<{ label: string; value: string }> = []; for (const [label, value, unit] of [["Peso", item.weight, item.weightUnit], ["Grasa corporal", item.bodyFat, item.bodyFatUnit], ["Pecho", item.chest, item.chestUnit], ["Cintura", item.waist, item.waistUnit], ["Cadera", item.hips, item.hipsUnit], ["Brazo", item.arm, item.armUnit], ["Muslo", item.thigh, item.thighUnit]] as const) if (value !== null) rows.push({ label, value: `${String(value)} ${unit === "PERCENT" ? "%" : unit?.toLowerCase()}` }); if (item.notes) rows.push({ label: "Notas", value: item.notes }); return rows; }
async function eventPair(tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], workspaceId: string, actorId: string, action: string, name: string, entityType: string, entityId: string, dedupeKey: string, metadata?: Record<string, string | null>) {
  await tx.auditEvent.upsert({ where: { workspaceId_dedupeKey: { workspaceId, dedupeKey } }, update: {}, create: { workspaceId, actorId, action, entityType, entityId, dedupeKey, metadata } });
  await tx.productEvent.upsert({ where: { workspaceId_dedupeKey: { workspaceId, dedupeKey } }, update: {}, create: { workspaceId, userId: actorId, name, dedupeKey, properties: { entityId, ...metadata } } });
}
