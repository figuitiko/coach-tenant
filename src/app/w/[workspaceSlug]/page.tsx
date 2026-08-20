import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { listCoachRoster, listCurrentMemberships, requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export const runtime = "nodejs";

export default async function TenantWorkspacePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  let access;
  let current;
  try {
    [access, current] = await Promise.all([
      requireWorkspaceAccess(workspaceSlug),
      listCurrentMemberships(),
    ]);
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof CrossTenantAccessError) notFound();
    throw error;
  }
  const students = access.workspace.role === "COACH" ? await listCoachRoster(access.workspace.workspaceId) : [];
  return <WorkspaceShell currentMembership={access.workspace} memberships={current?.memberships ?? [access.workspace]} students={students} />;
}
