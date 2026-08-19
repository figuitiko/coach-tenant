import { NextResponse } from "next/server";
import { progressService } from "@/modules/progress/infrastructure/progress-use-cases";
import { privateMediaFromEnvironment, s3SignerFromEnvironment } from "@/modules/progress/infrastructure/private-media";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceSlug: string; photoId: string }> }) {
  const { workspaceSlug, photoId } = await params;
  const access = await requireWorkspaceAccess(workspaceSlug);
  const actor = { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role } as const;
  const photo = await progressService.getPhotoDownload(actor, photoId);
  const signed = await privateMediaFromEnvironment(s3SignerFromEnvironment()).createDownloadUrl({ workspaceId: actor.workspaceId, studentId: photo.studentId, objectKey: photo.objectKey });
  return NextResponse.redirect(signed.downloadUrl, { headers: { "Cache-Control": "private, no-store" } });
}
