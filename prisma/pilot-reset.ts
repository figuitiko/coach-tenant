import type { PrismaClient } from "../src/generated/prisma/client";
import { deleteWorkspaceMarketingData } from "./marketing-cleanup";

export const PILOT_WORKSPACE_SLUGS = ["fuerza-norte-pilot", "movimiento-sur-pilot"] as const;

const PILOT_USER_IDS = [
  "pilot-coach",
  "pilot-admin",
  "pilot-coach-north",
  "pilot-coach-south",
  "pilot-student-1",
  "pilot-student-2",
  "pilot-student-3",
  "pilot-student-4",
  "pilot-student-5",
] as const;

export async function resetPilotFixtures(database: PrismaClient) {
  await database.$transaction(async (transaction) => {
    const [workspaces, invitedUsers] = await Promise.all([
      transaction.workspace.findMany({
        where: { slug: { in: [...PILOT_WORKSPACE_SLUGS] } },
        select: { id: true },
      }),
      transaction.user.findMany({
        where: { email: "pilot.invited@tenand.local" },
        select: { id: true },
      }),
    ]);
    const workspaceIds = workspaces.map(({ id }) => id);

    if (workspaceIds.length) {
      const workspaceFilter = { in: workspaceIds };

      await transaction.reviewReply.deleteMany({ where: { workspaceId: workspaceFilter } });
      await transaction.reviewNote.deleteMany({ where: { OR: [
        { workspaceId: workspaceFilter },
        { checkIn: { workspaceId: workspaceFilter } },
        { workoutSession: { assignedWorkout: { workspaceId: workspaceFilter } } },
      ] } });
      await deleteWorkspaceMarketingData(transaction, workspaceIds);
      await transaction.progressPhoto.deleteMany({ where: { OR: [
        { workspaceId: workspaceFilter },
        { checkIn: { workspaceId: workspaceFilter } },
        { uploadIntent: { workspaceId: workspaceFilter } },
      ] } });
      await transaction.photoUploadIntent.deleteMany({ where: { OR: [
        { workspaceId: workspaceFilter },
        { checkIn: { workspaceId: workspaceFilter } },
      ] } });
      await transaction.measurementCheckIn.deleteMany({ where: { workspaceId: workspaceFilter } });

      await transaction.setLog.deleteMany({ where: { exerciseLog: { session: { assignedWorkout: { workspaceId: workspaceFilter } } } } });
      await transaction.exerciseLog.deleteMany({ where: { OR: [
        { session: { assignedWorkout: { workspaceId: workspaceFilter } } },
        { assignedExercise: { assignedWorkout: { workspaceId: workspaceFilter } } },
      ] } });
      await transaction.workoutSession.deleteMany({ where: { assignedWorkout: { workspaceId: workspaceFilter } } });
      await transaction.assignedExercise.deleteMany({ where: { assignedWorkout: { workspaceId: workspaceFilter } } });
      await transaction.assignedWorkout.deleteMany({ where: { OR: [
        { workspaceId: workspaceFilter },
        { assignment: { workspaceId: workspaceFilter } },
        { planWorkout: { plan: { workspaceId: workspaceFilter } } },
        { planWorkout: { template: { workspaceId: workspaceFilter } } },
      ] } });
      await transaction.studentPlanAssignment.deleteMany({ where: { OR: [
        { workspaceId: workspaceFilter },
        { plan: { workspaceId: workspaceFilter } },
        { studentMembership: { workspaceId: workspaceFilter } },
      ] } });
      await transaction.planWorkout.deleteMany({ where: { OR: [
        { plan: { workspaceId: workspaceFilter } },
        { template: { workspaceId: workspaceFilter } },
      ] } });
      await transaction.workoutPlan.deleteMany({ where: { workspaceId: workspaceFilter } });

      await transaction.templateExercise.deleteMany({ where: { OR: [
        { template: { workspaceId: workspaceFilter } },
        { exercise: { workspaceId: workspaceFilter } },
      ] } });
      await transaction.workoutTemplate.deleteMany({ where: { workspaceId: workspaceFilter } });
      await transaction.exercise.deleteMany({ where: { workspaceId: workspaceFilter } });

      await transaction.invitation.deleteMany({ where: { workspaceId: workspaceFilter } });
      await transaction.auditEvent.deleteMany({ where: { workspaceId: workspaceFilter } });
      await transaction.productEvent.deleteMany({ where: { workspaceId: workspaceFilter } });
      await transaction.membership.deleteMany({ where: { workspaceId: workspaceFilter } });
      await transaction.workspace.deleteMany({ where: { id: workspaceFilter } });
    }

    const userIds = [...PILOT_USER_IDS, ...invitedUsers.map(({ id }) => id)];
    await transaction.account.deleteMany({ where: { userId: { in: userIds } } });
    await transaction.user.deleteMany({ where: { id: { in: userIds } } });
  });
}
