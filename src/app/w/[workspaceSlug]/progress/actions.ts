"use server";

import { revalidatePath } from "next/cache";
import { ProgressAccessDeniedError, ProgressValidationError, type CheckInMetrics, type ProgressActor, type ReviewKind } from "@/modules/progress/application/progress-service";
import { PrivateMediaError, privateMediaFromEnvironment, s3SignerFromEnvironment } from "@/modules/progress/infrastructure/private-media";
import { progressService } from "@/modules/progress/infrastructure/progress-use-cases";
import type { ProgressActionState } from "@/modules/progress/presentation/progress-view";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export async function saveDraftAction(slug: string, _state: ProgressActionState, data: FormData) { return execute(slug, async actor => { await progressService.editDraft(actor, { checkInId: text(data, "checkInId"), metrics: metrics(data), notes: optional(data, "notes") }); }); }
export async function submitCheckInAction(slug: string, _state: ProgressActionState, data: FormData) { return execute(slug, async actor => { await progressService.submitDraft(actor, { checkInId: text(data, "checkInId"), idempotencyKey: text(data, "idempotencyKey") }); }); }
export async function attachPhotoAction(slug: string, _state: ProgressActionState, data: FormData) { return execute(slug, async actor => { const uploadIntentId = text(data, "uploadIntentId"); const intent = await progressService.getUploadIntent(actor, uploadIntentId); const media = privateMediaFromEnvironment(s3SignerFromEnvironment()); await media.verifyUploadedObject(intent); await progressService.attachPhoto(actor, { uploadIntentId }); }); }
export async function completeReviewAction(slug: string, _state: ProgressActionState, data: FormData) { return execute(slug, async actor => { await progressService.completeReview(actor, { kind: reviewKind(data), itemId: text(data, "itemId"), note: optional(data, "note") ?? "", idempotencyKey: text(data, "idempotencyKey") }); }); }

export async function requestUploadAction(slug: string, _state: ProgressActionState, data: FormData): Promise<ProgressActionState> {
  try {
    const actor = await actorFor(slug);
    if (actor.role !== "STUDENT") throw new ProgressAccessDeniedError();
    const checkInId = text(data, "checkInId");
    const dashboard = await progressService.getStudentProgress(actor);
    if (dashboard.draft?.id !== checkInId) throw new ProgressAccessDeniedError();
    const media = privateMediaFromEnvironment(s3SignerFromEnvironment());
    const checksumSha256 = text(data, "checksumSha256");
    const proposed = await media.createUploadIntent({ workspaceId: actor.workspaceId, studentId: actor.actorId, fileName: text(data, "fileName"), mimeType: text(data, "mimeType"), sizeBytes: integer(data, "sizeBytes"), checksumSha256 });
    const intent = await progressService.reserveUploadIntent(actor, { checkInId, idempotencyKey: text(data, "idempotencyKey"), objectKey: proposed.objectKey, mimeType: text(data, "mimeType"), sizeBytes: integer(data, "sizeBytes"), checksumSha256, expiresAt: proposed.expiresAt });
    const url = await media.signUploadIntent(intent);
    return { status: "success", message: "Subida privada preparada.", upload: { url, headers: proposed.uploadHeaders, intentId: intent.id, expiresAt: intent.expiresAt.toISOString() } };
  } catch (error) { return expected(error); }
}

async function execute(slug: string, operation: (actor: ProgressActor) => Promise<void>): Promise<ProgressActionState> { try { await operation(await actorFor(slug)); revalidatePath(`/w/${slug}/progress`); return { status: "success", message: "Cambios guardados." }; } catch (error) { return expected(error); } }
function expected(error: unknown): ProgressActionState { if (error instanceof ProgressAccessDeniedError || error instanceof ProgressValidationError || error instanceof PrivateMediaError || error instanceof CrossTenantAccessError || error instanceof UnauthenticatedError) return { status: "error", message: "No pudimos guardar el progreso. Revisá los datos e intentá de nuevo." }; throw error; }
async function actorFor(slug: string): Promise<ProgressActor> { const access = await requireWorkspaceAccess(slug); return { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role }; }
function text(data: FormData, key: string) { const value = data.get(key); if (typeof value !== "string" || !value.trim() || value.length > 500) throw new ProgressValidationError(); return value.trim(); }
function optional(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function integer(data: FormData, key: string) { const value = Number(text(data, key)); if (!Number.isInteger(value)) throw new ProgressValidationError(); return value; }
function metric(data: FormData, name: string) { const raw = data.get(`${name}Value`); if (raw === null || raw === "") return null; const value = Number(raw); const unit = text(data, `${name}Unit`) as never; return { value, unit }; }
function metrics(data: FormData): CheckInMetrics { return { weight: metric(data, "weight"), bodyFat: metric(data, "bodyFat"), chest: metric(data, "chest"), waist: metric(data, "waist"), hips: metric(data, "hips"), arm: metric(data, "arm"), thigh: metric(data, "thigh") }; }
function reviewKind(data: FormData) { const value = text(data, "kind"); if (value !== "CHECK_IN" && value !== "WORKOUT") throw new ProgressValidationError(); return value satisfies ReviewKind; }
