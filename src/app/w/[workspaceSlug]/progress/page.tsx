import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { progressService } from "@/modules/progress/infrastructure/progress-use-cases";
import { CoachReviewView, StudentProgressView } from "@/modules/progress/presentation/progress-view";
import { attachPhotoAction, completeReviewAction, requestUploadAction, saveDraftAction, submitCheckInAction } from "./actions";

export const runtime = "nodejs";
export default async function ProgressPage({ params, searchParams }: { params: Promise<{ workspaceSlug: string }>; searchParams: Promise<{ kind?: string; itemId?: string }> }) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const { actor, dashboard, queue, detail } = await load(workspaceSlug, query);
  const content = actor.role === "STUDENT"
    ? <StudentProgressView draft={dashboard!.draft!} history={dashboard!.history} actions={{ saveDraft: saveDraftAction.bind(null, workspaceSlug), submit: submitCheckInAction.bind(null, workspaceSlug), requestUpload: requestUploadAction.bind(null, workspaceSlug), attachPhoto: attachPhotoAction.bind(null, workspaceSlug) }}/>
    : <CoachReviewView queue={queue!} detail={detail!} reviewAction={completeReviewAction.bind(null, workspaceSlug)}/>;
  return <main className="min-h-screen bg-[var(--paper-light)] pb-12"><nav aria-label="Miga de pan" className="border-b border-[var(--line)] px-5 py-4 sm:px-8 lg:px-10"><Link className="text-sm font-extrabold text-[var(--signal-dark)] underline underline-offset-4" href={`/w/${workspaceSlug}`}>← Volver al panel</Link></nav>{content}</main>;
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
