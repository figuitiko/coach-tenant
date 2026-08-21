import { notFound, redirect } from "next/navigation";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { progressService } from "@/modules/progress/infrastructure/progress-use-cases";
import { CoachReviewView, StudentProgressView } from "@/modules/progress/presentation/progress-view";
import { attachPhotoAction, completeReviewAction, replyToReviewAction, requestUploadAction, saveOrSubmitCheckInAction } from "./actions";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";

export const runtime = "nodejs";
export default async function ProgressPage({ params, searchParams }: { params: Promise<{ workspaceSlug: string }>; searchParams: Promise<{ kind?: string; itemId?: string }> }) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const { actor, dashboard, queue, detail } = await load(workspaceSlug, query);
  const content = actor.role === "STUDENT"
    ? <StudentProgressView draft={dashboard!.draft!} history={dashboard!.history} actions={{ saveOrSubmit: saveOrSubmitCheckInAction.bind(null, workspaceSlug), reply: replyToReviewAction.bind(null, workspaceSlug), requestUpload: requestUploadAction.bind(null, workspaceSlug), attachPhoto: attachPhotoAction.bind(null, workspaceSlug) }}/>
    : <CoachReviewView queue={queue!} detail={detail!} reviewAction={completeReviewAction.bind(null, workspaceSlug)}/>;
  return <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12"><WorkspaceNavigation workspaceSlug={workspaceSlug} role={actor.role}/>{content}</main>;
}

async function load(workspaceSlug: string, query: { kind?: string; itemId?: string }) {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    const actor = { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role } as const;
    if (actor.role === "STUDENT") {
      let dashboard = await progressService.getStudentProgress(actor);
      if (!dashboard.draft) { await progressService.createDraft(actor); dashboard = await progressService.getStudentProgress(actor); }
      return { actor, dashboard, queue: null, detail: null };
    } else {
      const kind = query.kind === "CHECK_IN" || query.kind === "WORKOUT" ? query.kind : null;
      const detail = kind && query.itemId ? await progressService.getReviewDetail(actor, kind, query.itemId) : null;
      return { actor, dashboard: null, queue: await progressService.getReviewQueue(actor), detail };
    }
  } catch (error) { if (error instanceof UnauthenticatedError) redirect("/sign-in"); if (error instanceof CrossTenantAccessError) notFound(); throw error; }
}
