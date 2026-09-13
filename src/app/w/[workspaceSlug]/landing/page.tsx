import { notFound, redirect } from "next/navigation";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";
import type { MarketingActor } from "@/modules/marketing/application/marketing-service";
import { MarketingAccessDeniedError, MarketingNotFoundError } from "@/modules/marketing/domain/errors";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";
import { LandingEditor } from "@/modules/marketing/presentation/landing-editor";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { publishLandingAction, saveLandingDraftAction, unpublishLandingAction } from "./actions";

export const runtime = "nodejs";

type SearchParams = Promise<{ saved?: string; published?: string; unpublished?: string }>;

export default async function LandingEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: SearchParams;
}) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const { editor, navigationRole } = await loadLandingEditor(workspaceSlug);
  const notice = query.published ? "published" : query.unpublished ? "unpublished" : query.saved ? "saved" : null;

  return (
    <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12">
      <WorkspaceNavigation workspaceSlug={workspaceSlug} role={navigationRole} />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <LandingEditor
          actions={{
            saveDraft: saveLandingDraftAction.bind(null, workspaceSlug),
            publish: publishLandingAction.bind(null, workspaceSlug),
            unpublish: unpublishLandingAction.bind(null, workspaceSlug),
          }}
          editor={editor}
          notice={notice}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </main>
  );
}

async function loadLandingEditor(workspaceSlug: string) {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    const actor: MarketingActor = {
      actorId: access.userId,
      workspaceId: access.workspace.workspaceId,
      role: access.workspace.role,
      accessMode: access.workspace.accessMode === "SUPER_ADMIN" ? "WORKSPACE" : undefined,
    };
    return { actor, navigationRole: access.workspace.role, editor: await marketingService.getEditor(actor) };
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (
      error instanceof CrossTenantAccessError ||
      error instanceof MarketingAccessDeniedError ||
      error instanceof MarketingNotFoundError
    )
      notFound();
    throw error;
  }
}
