import { notFound, redirect } from "next/navigation";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";
import type { MarketingActor } from "@/modules/marketing/application/marketing-service";
import { MarketingAccessDeniedError, MarketingNotFoundError } from "@/modules/marketing/domain/errors";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";
import { StudentResultApprovalsView } from "@/modules/marketing/presentation/student-result-approvals-view";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { approveResultAction, revokeResultAction } from "./actions";

export const runtime = "nodejs";

type SearchParams = Promise<{ approved?: string; revoked?: string; error?: string }>;

export default async function StudentResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: SearchParams;
}) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const approvals = await loadStudentApprovals(workspaceSlug);
  const notice = query.approved ? "approved" : query.revoked ? "revoked" : query.error ? "error" : null;

  return (
    <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12">
      <WorkspaceNavigation workspaceSlug={workspaceSlug} role="STUDENT" />
      <StudentResultApprovalsView
        actions={{
          approve: approveResultAction.bind(null, workspaceSlug),
          revoke: revokeResultAction.bind(null, workspaceSlug),
        }}
        approvals={approvals}
        notice={notice}
      />
    </main>
  );
}

async function loadStudentApprovals(workspaceSlug: string) {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    const actor: MarketingActor = {
      actorId: access.userId,
      workspaceId: access.workspace.workspaceId,
      role: access.workspace.role,
    };
    return await marketingService.listApprovalRequests(actor);
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
