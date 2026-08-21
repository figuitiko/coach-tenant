import { notFound, redirect } from "next/navigation";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { trainingService } from "@/modules/training/infrastructure/training-use-cases";
import { CoachTrainingView, StudentTrainingView } from "@/modules/training/presentation/training-view";
import { calendarDateInTimeZone, isCalendarDate } from "@/modules/training/presentation/local-date";
import { assignPlanAction, completeWorkoutAction, createExerciseAction, createPlanAction, createTemplateAction, editTemplateAction, saveSetAction } from "./actions";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";
import { replyToReviewAction } from "@/app/w/[workspaceSlug]/progress/actions";

export const runtime = "nodejs";

export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ date?: string; studentMembershipId?: string }>;
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
    replyToReview: replyToReviewAction.bind(null, workspaceSlug),
  };
  let training;
  if (actor.role === "COACH") {
    const dashboard = await trainingService.getCoachDashboard(actor);
    if (query.studentMembershipId && !dashboard.students.some((student) => student.membershipId === query.studentMembershipId)) notFound();
    training = <CoachTrainingView dashboard={dashboard} selectedStudentMembershipId={query.studentMembershipId} actions={actions} />;
  } else {
    const overview = await trainingService.getStudentPlanOverview(actor);
    const selectedDate = query.date && isCalendarDate(query.date)
      ? date
      : overview.find((workout) => workout.status !== "COMPLETED" && workout.scheduledOn >= date)?.scheduledOn ?? overview.at(-1)?.scheduledOn ?? date;
    training = <StudentTrainingView date={selectedDate} workouts={overview.filter((workout) => workout.scheduledOn === selectedDate)} overview={overview} actions={actions} />;
  }
  return (
    <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12">
      <WorkspaceNavigation workspaceSlug={workspaceSlug} role={actor.role}/>
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
