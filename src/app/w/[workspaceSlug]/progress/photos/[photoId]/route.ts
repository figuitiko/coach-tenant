import { NextResponse } from "next/server";
import { ProgressAccessDeniedError } from "@/modules/progress/application/progress-service";
import { progressService } from "@/modules/progress/infrastructure/progress-use-cases";
import { PrivateMediaError, privateMediaFromEnvironment, s3SignerFromEnvironment } from "@/modules/progress/infrastructure/private-media";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ workspaceSlug: string; photoId: string }> }) {
  try {
    const { workspaceSlug, photoId } = await params;
    const access = await requireWorkspaceAccess(workspaceSlug);
    const actor = { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role } as const;
    const photo = await progressService.getPhotoDownload(actor, photoId);
    const signed = await privateMediaFromEnvironment(s3SignerFromEnvironment()).createDownloadUrl({ workspaceId: actor.workspaceId, studentId: photo.studentId, objectKey: photo.objectKey });
    return NextResponse.redirect(signed.downloadUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return request.headers.get("accept")?.includes("text/html")
      ? NextResponse.redirect(new URL("/sign-in", request.url))
      : new NextResponse(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof CrossTenantAccessError || error instanceof ProgressAccessDeniedError || error instanceof PrivateMediaError) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    throw error;
  }
}
