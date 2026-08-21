import { notFound, redirect } from "next/navigation";
import { createInvitationAction, revokeInvitationAction } from "@/app/actions/invitations";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { listCoachRoster, requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { invitationService } from "@/modules/tenancy/infrastructure/invitation-use-cases";
import { CoachStudentsView } from "@/modules/tenancy/presentation/coach-students-view";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";

export const runtime = "nodejs";

export default async function StudentsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const { students, invitations } = await loadStudents(workspaceSlug);
  return <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12"><WorkspaceNavigation workspaceSlug={workspaceSlug} role="COACH"/><CoachStudentsView workspaceSlug={workspaceSlug} students={students} invitations={invitations.map((invitation) => ({ ...invitation, createdAt: invitation.createdAt.toISOString(), expiresAt: invitation.expiresAt.toISOString() }))} createInvitation={createInvitationAction} revokeInvitation={revokeInvitationAction} /></main>;
}

async function loadStudents(workspaceSlug: string) {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    if (access.workspace.role !== "COACH") notFound();
    const [students, invitations] = await Promise.all([
      listCoachRoster(access.workspace.workspaceId),
      invitationService.list({ actorId: access.userId, workspaceSlug }),
    ]);
    return { students, invitations };
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof CrossTenantAccessError) notFound();
    throw error;
  }
}
