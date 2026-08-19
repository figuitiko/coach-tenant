export type ProgressActor = { actorId: string; workspaceId: string; role: "COACH" | "STUDENT" };
export type LengthUnit = "CM" | "IN";
export type MetricValue = { value: number; unit: "KG" | "LB" | "PERCENT" | LengthUnit };
export type CheckInMetrics = {
  weight: { value: number; unit: "KG" | "LB" } | null;
  bodyFat: { value: number; unit: "PERCENT" } | null;
  chest: { value: number; unit: LengthUnit } | null;
  waist: { value: number; unit: LengthUnit } | null;
  hips: { value: number; unit: LengthUnit } | null;
  arm: { value: number; unit: LengthUnit } | null;
  thigh: { value: number; unit: LengthUnit } | null;
};
export type ReviewKind = "CHECK_IN" | "WORKOUT";
export type ReviewQueueItem = { kind: ReviewKind; id: string; studentId: string; studentName: string; submittedAt: Date };
export type ReviewDetail = { kind: ReviewKind; id: string; studentId: string; studentName: string; reviewStatus: "PENDING" | "REVIEWED"; details: Array<{ label: string; value: string }>; photos: Array<{ id: string; mimeType: string }>; notes: Array<{ id: string; body: string; createdAt: Date }> };
export type StudentProgress = { draft: { id: string; status: string; metrics: Record<string, unknown>; notes: string | null; photos: Array<{ id: string; mimeType: string; sizeBytes: number }> } | null; history: Array<{ id: string; submittedAt: Date | null; notes: string | null }> };
export type UploadIntent = { id: string; objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string; expiresAt: Date; status: "PENDING" | "CONSUMED" | "EXPIRED" };

export interface ProgressRepository {
  createDraft(input: { workspaceId: string; studentId: string; createdAt: Date }): Promise<{ id: string; status: "DRAFT" }>;
  editDraft(input: { workspaceId: string; studentId: string; checkInId: string; metrics: CheckInMetrics; notes: string | null }): Promise<{ id: string; status: "DRAFT" } | null>;
  submitDraft(input: { workspaceId: string; studentId: string; checkInId: string; idempotencyKey: string; submittedAt: Date }): Promise<{ id: string; status: "SUBMITTED" } | null>;
  reserveUploadIntent(input: { workspaceId: string; studentId: string; checkInId: string; idempotencyKey: string; objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string; expiresAt: Date }): Promise<UploadIntent | null>;
  getUploadIntent(input: { workspaceId: string; studentId: string; uploadIntentId: string }): Promise<UploadIntent | null>;
  attachPhoto(input: { workspaceId: string; studentId: string; uploadIntentId: string; attachedAt: Date }): Promise<{ id: string } | null>;
  listStudentHistory(input: { workspaceId: string; studentId: string }): Promise<unknown[] | null>;
  getStudentProgress(input: { workspaceId: string; studentId: string }): Promise<StudentProgress | null>;
  getStudentPhoto(input: { workspaceId: string; studentId: string; photoId: string }): Promise<{ objectKey: string; studentId: string; mimeType: string; sizeBytes: number } | null>;
  getCoachPhoto(input: { workspaceId: string; coachId: string; photoId: string }): Promise<{ objectKey: string; studentId: string; mimeType: string; sizeBytes: number } | null>;
  listReviewQueue(input: { workspaceId: string; coachId: string }): Promise<ReviewQueueItem[]>;
  getReviewDetail(input: { workspaceId: string; coachId: string; kind: ReviewKind; itemId: string }): Promise<ReviewDetail | null>;
  completeReview(input: { workspaceId: string; coachId: string; kind: ReviewKind; itemId: string; note: string; idempotencyKey: string; reviewedAt: Date }): Promise<{ id: string; reviewed: boolean } | null>;
}

export class ProgressAccessDeniedError extends Error {}
export class ProgressValidationError extends Error {}

export class ProgressService {
  constructor(private readonly repository: ProgressRepository, private readonly now = () => new Date()) {}

  async createDraft(actor: ProgressActor) {
    requireRole(actor, "STUDENT");
    return this.repository.createDraft({ workspaceId: actor.workspaceId, studentId: actor.actorId, createdAt: this.now() });
  }

  async editDraft(actor: ProgressActor, input: { checkInId: string; metrics: CheckInMetrics; notes: string | null }) {
    requireRole(actor, "STUDENT");
    validateMetrics(input.metrics);
    const notes = optionalText(input.notes, 1000);
    const result = await this.repository.editDraft({ workspaceId: actor.workspaceId, studentId: actor.actorId, checkInId: requiredId(input.checkInId), metrics: structuredClone(input.metrics), notes });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async submitDraft(actor: ProgressActor, input: { checkInId: string; idempotencyKey: string }) {
    requireRole(actor, "STUDENT");
    const result = await this.repository.submitDraft({ workspaceId: actor.workspaceId, studentId: actor.actorId, checkInId: requiredId(input.checkInId), idempotencyKey: requiredId(input.idempotencyKey), submittedAt: this.now() });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async reserveUploadIntent(actor: ProgressActor, input: { checkInId: string; idempotencyKey: string; objectKey: string; mimeType: string; sizeBytes: number; checksumSha256: string; expiresAt: Date }) {
    requireRole(actor, "STUDENT");
    if (input.expiresAt <= this.now()) throw new ProgressValidationError("Upload intent expired");
    const result = await this.repository.reserveUploadIntent({ ...input, workspaceId: actor.workspaceId, studentId: actor.actorId });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async attachPhoto(actor: ProgressActor, input: { uploadIntentId: string }) {
    requireRole(actor, "STUDENT");
    const result = await this.repository.attachPhoto({ workspaceId: actor.workspaceId, studentId: actor.actorId, uploadIntentId: requiredId(input.uploadIntentId), attachedAt: this.now() });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async getUploadIntent(actor: ProgressActor, uploadIntentId: string) {
    requireRole(actor, "STUDENT");
    const result = await this.repository.getUploadIntent({ workspaceId: actor.workspaceId, studentId: actor.actorId, uploadIntentId: requiredId(uploadIntentId) });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async getHistory(actor: ProgressActor) {
    requireRole(actor, "STUDENT");
    const result = await this.repository.listStudentHistory({ workspaceId: actor.workspaceId, studentId: actor.actorId });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async getStudentProgress(actor: ProgressActor) {
    requireRole(actor, "STUDENT");
    const result = await this.repository.getStudentProgress({ workspaceId: actor.workspaceId, studentId: actor.actorId });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async getPhotoDownload(actor: ProgressActor, photoId: string) {
    const result = actor.role === "STUDENT"
      ? await this.repository.getStudentPhoto({ workspaceId: actor.workspaceId, studentId: actor.actorId, photoId })
      : await this.repository.getCoachPhoto({ workspaceId: actor.workspaceId, coachId: actor.actorId, photoId });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async getReviewQueue(actor: ProgressActor) {
    requireRole(actor, "COACH");
    return this.repository.listReviewQueue({ workspaceId: actor.workspaceId, coachId: actor.actorId });
  }

  async getReviewDetail(actor: ProgressActor, kind: ReviewKind, itemId: string) {
    requireRole(actor, "COACH");
    const result = await this.repository.getReviewDetail({ workspaceId: actor.workspaceId, coachId: actor.actorId, kind, itemId });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }

  async completeReview(actor: ProgressActor, input: { kind: ReviewKind; itemId: string; note: string; idempotencyKey: string }) {
    requireRole(actor, "COACH");
    const result = await this.repository.completeReview({ ...input, workspaceId: actor.workspaceId, coachId: actor.actorId, note: optionalText(input.note, 2000) ?? "", reviewedAt: this.now() });
    if (!result) throw new ProgressAccessDeniedError();
    return result;
  }
}

function requireRole(actor: ProgressActor, role: ProgressActor["role"]) {
  if (actor.role !== role) throw new ProgressAccessDeniedError();
}

function requiredId(value: string) {
  if (!value?.trim() || value.length > 160) throw new ProgressValidationError("Invalid identifier");
  return value;
}

function optionalText(value: string | null, max: number) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > max) throw new ProgressValidationError("Text is too long");
  return normalized;
}

function validateMetrics(metrics: CheckInMetrics) {
  validate(metrics.weight, ["KG", "LB"], 20, 500);
  validate(metrics.bodyFat, ["PERCENT"], 0, 100);
  for (const metric of [metrics.chest, metrics.waist, metrics.hips, metrics.arm, metrics.thigh]) validate(metric, ["CM", "IN"], 1, 400);
}

function validate(metric: MetricValue | null, units: MetricValue["unit"][], min: number, max: number) {
  if (metric === null) return;
  if (!Number.isFinite(metric.value) || metric.value < min || metric.value > max || !units.includes(metric.unit)) throw new ProgressValidationError("Metric is invalid");
}
