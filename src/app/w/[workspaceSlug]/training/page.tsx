import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { trainingService } from "@/modules/training/infrastructure/training-use-cases";
import { CoachTrainingView, StudentTrainingView } from "@/modules/training/presentation/training-view";
import { calendarDateInTimeZone, isCalendarDate } from "@/modules/training/presentation/local-date";
import { assignPlanAction, completeWorkoutAction, createExerciseAction, createPlanAction, createTemplateAction, editTemplateAction, saveSetAction } from "./actions";

export const runtime = "nodejs";

export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ workspaceSlug }, query] = await Promise.all([params, searchParams]);
  const { actor, date } = await loadTrainingContext(workspaceSlug, query.date);
  const actions = {
    createExercise: createExerciseAction.bind(null, workspaceSlug),
    createTemplate: createTemplateAction.bind(null, workspaceSlug),
    editTemplate: editTemplateAction.bind(null, workspaceSlug),
    createPlan: createPlanAction.bind(null, workspaceSlug),
    assignPlan: assignPlanAction.bind(null, workspaceSlug),
    saveSet: saveSetAction.bind(null, workspaceSlug),
    completeWorkout: completeWorkoutAction.bind(null, workspaceSlug),
  };
  const training = actor.role === "COACH"
    ? <CoachTrainingView dashboard={await trainingService.getCoachDashboard(actor)} actions={actions} />
    : <StudentTrainingView date={date} workouts={await trainingService.getStudentSchedule(actor, date)} actions={actions} />;
  return (
    <main className="min-h-screen bg-[var(--paper-light)] pb-12">
      <nav aria-label="Miga de pan" className="border-b border-[var(--line)] px-5 py-4 sm:px-8 lg:px-10">
        <Link className="text-sm font-extrabold text-[var(--signal-dark)] underline underline-offset-4" href={`/w/${workspaceSlug}`}>← Volver al panel</Link>
      </nav>
      {training}
    </main>
  );
}

async function loadTrainingContext(workspaceSlug: string, requestedDate?: string) {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    const actor = { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role } as const;
    const date = requestedDate && isCalendarDate(requestedDate)
      ? requestedDate
      : calendarDateInTimeZone(new Date(), access.workspace.timeZone);
    return { actor, date };
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof CrossTenantAccessError) notFound();
    throw error;
  }
}
