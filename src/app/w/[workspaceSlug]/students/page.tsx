import { notFound, redirect } from "next/navigation";
import { createManualStudentAction } from "@/app/actions/members";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { listCoachRoster, requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { CoachStudentsView } from "@/modules/tenancy/presentation/coach-students-view";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";

export const runtime = "nodejs";

export default async function StudentsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const { students } = await loadStudents(workspaceSlug);
  return (
    <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12">
      <WorkspaceNavigation workspaceSlug={workspaceSlug} role="COACH" />
      <CoachStudentsView
        workspaceSlug={workspaceSlug}
        students={students}
        createManualStudent={createManualStudentAction}
      />
    </main>
  );
}

async function loadStudents(workspaceSlug: string) {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    if (access.workspace.role !== "COACH") notFound();
    const students = await listCoachRoster(access.workspace.workspaceId);
    return { students };
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof CrossTenantAccessError) notFound();
    throw error;
  }
}
