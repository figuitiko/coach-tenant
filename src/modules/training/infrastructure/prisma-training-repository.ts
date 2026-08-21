import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { TrainingAccessDeniedError, TrainingValidationError, type AssignedWorkout, type CoachTrainingDashboard, type PlanScheduleInput, type PrescribedExercise, type SaveSetInput, type TrainingRepository } from "../application/training-service";
import { isWorkspaceRoleAuthorized } from "@/modules/tenancy/infrastructure/workspace-role-authorization";

const workoutInclude = {
  exercises: { orderBy: { order: "asc" as const } },
  session: {
    include: {
      exerciseLogs: { include: { sets: { orderBy: { setNumber: "asc" as const } } } },
      reviewNotes: { orderBy: { createdAt: "asc" as const }, select: { id: true, body: true, reply: { select: { body: true } } } },
    },
  },
} satisfies Prisma.AssignedWorkoutInclude;

type WorkoutRecord = Prisma.AssignedWorkoutGetPayload<{ include: typeof workoutInclude }>;
type SessionRecord = Prisma.WorkoutSessionGetPayload<{ select: {
  id: true;
  startedAt: true;
  completedAt: true;
  exerciseLogs: { select: { assignedExerciseId: true; sets: true } };
} }>;

export class PrismaTrainingRepository implements TrainingRepository {
  constructor(private readonly database: PrismaClient) {}

  async createExercise(input: { workspaceId: string; actorId: string; name: string; notes: string | null }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const exercise = await tx.exercise.create({ data: { workspaceId: input.workspaceId, createdById: input.actorId, name: input.name, notes: input.notes }, select: { id: true, name: true } });
      await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.actorId, action: "exercise.created", entityType: "Exercise", entityId: exercise.id } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.actorId, name: "exercise_created", properties: { exerciseId: exercise.id } } }),
      ]);
      return exercise;
    });
  }

  async createTemplate(input: { workspaceId: string; actorId: string; name: string; description?: string | null; exercises: PrescribedExercise[] }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const scopedExercises = await tx.exercise.count({ where: { workspaceId: input.workspaceId, id: { in: input.exercises.map((exercise) => exercise.exerciseId) } } });
      if (scopedExercises !== new Set(input.exercises.map((exercise) => exercise.exerciseId)).size) throw new TrainingAccessDeniedError();
      const template = await tx.workoutTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          createdById: input.actorId,
          name: input.name,
          description: input.description,
          exercises: { create: input.exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, order: exercise.order, prescribedSets: exercise.prescribedSets, repMin: exercise.repMin, repMax: exercise.repMax, targetRpe: exercise.targetRpe, restSeconds: exercise.restSeconds, notes: exercise.notes })) },
        },
        select: { id: true, name: true },
      });
      await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.actorId, action: "workout_template.created", entityType: "WorkoutTemplate", entityId: template.id } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.actorId, name: "workout_template_created", properties: { templateId: template.id } } }),
      ]);
      return template;
    });
  }

  async editTemplate(input: { workspaceId: string; actorId: string; templateId: string; name: string; description: string | null; exercises: PrescribedExercise[] }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const [template, exerciseCount] = await Promise.all([
        tx.workoutTemplate.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId }, select: { id: true } }),
        tx.exercise.count({ where: { workspaceId: input.workspaceId, id: { in: input.exercises.map((exercise) => exercise.exerciseId) } } }),
      ]);
      if (!template) return null;
      if (exerciseCount !== new Set(input.exercises.map((exercise) => exercise.exerciseId)).size) throw new TrainingAccessDeniedError();
      await tx.templateExercise.deleteMany({ where: { templateId: template.id } });
      const updated = await tx.workoutTemplate.update({
        where: { id: template.id },
        data: {
          name: input.name,
          description: input.description,
          exercises: { create: input.exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, order: exercise.order, prescribedSets: exercise.prescribedSets, repMin: exercise.repMin, repMax: exercise.repMax, targetRpe: exercise.targetRpe, restSeconds: exercise.restSeconds, notes: exercise.notes })) },
        },
        select: { id: true, name: true },
      });
      await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.actorId, action: "workout_template.updated", entityType: "WorkoutTemplate", entityId: template.id } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.actorId, name: "workout_template_updated", properties: { templateId: template.id } } }),
      ]);
      return updated;
    });
  }

  async createPlan(input: PlanScheduleInput & { workspaceId: string; actorId: string }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const templateIds = [...new Set(input.workouts.map((workout) => workout.templateId))];
      const templateCount = await tx.workoutTemplate.count({ where: { id: { in: templateIds }, workspaceId: input.workspaceId } });
      if (templateCount !== templateIds.length) return null;
      const plan = await tx.workoutPlan.create({
        data: {
          workspaceId: input.workspaceId,
          createdById: input.actorId,
          name: input.name,
          startsOn: dateOnly(input.startsOn),
          endsOn: dateOnly(input.endsOn),
          workouts: { create: input.workouts.map((workout) => ({ templateId: workout.templateId, order: workout.order, scheduledOn: dateOnly(workout.scheduledOn) })) },
        },
        select: { id: true, name: true },
      });
      await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.actorId, action: "workout_plan.created", entityType: "WorkoutPlan", entityId: plan.id } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.actorId, name: "workout_plan_created", properties: { planId: plan.id, workoutCount: input.workouts.length } } }),
      ]);
      return plan;
    });
  }

  findMembership(membershipId: string) {
    return this.database.membership.findUnique({ where: { id: membershipId }, select: { workspaceId: true, role: true, userId: true } });
  }

  async assignSavedPlan(input: { workspaceId: string; actorId: string; studentMembershipId: string; planId: string }) {
    return serializableTransaction(this.database, async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const [membership, plan] = await Promise.all([
        tx.membership.findFirst({ where: { id: input.studentMembershipId, workspaceId: input.workspaceId, role: "STUDENT" }, select: { id: true, userId: true } }),
        tx.workoutPlan.findFirst({
          where: { id: input.planId, workspaceId: input.workspaceId },
          include: { workouts: { orderBy: { order: "asc" }, include: { template: { include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } } } } } } } } },
        }),
      ]);
      if (!membership || !plan) return null;
      const existing = await tx.studentPlanAssignment.findUnique({
        where: { workspaceId_planId_studentMembershipId: { workspaceId: input.workspaceId, planId: plan.id, studentMembershipId: membership.id } },
        select: { id: true },
      });
      if (existing) {
        const workouts = await tx.assignedWorkout.findMany({ where: { assignmentId: existing.id }, orderBy: { scheduledOn: "asc" }, include: workoutInclude });
        return { id: existing.id, workouts: workouts.map(mapWorkout) };
      }
      const assignment = await tx.studentPlanAssignment.create({
        data: {
          workspaceId: input.workspaceId,
          planId: plan.id,
          studentMembershipId: membership.id,
          assignedById: input.actorId,
          workouts: { create: plan.workouts.map((workout) => ({
            workspaceId: input.workspaceId,
            planWorkoutId: workout.id,
            sourceTemplateId: workout.templateId,
            studentId: membership.userId,
            templateName: workout.template.name,
            scheduledOn: workout.scheduledOn,
            exercises: { create: workout.template.exercises.map((item) => ({
              sourceExerciseId: item.exerciseId,
              exerciseName: item.exercise.name,
              order: item.order,
              prescribedSets: item.prescribedSets,
              repMin: item.repMin,
              repMax: item.repMax,
              targetRpe: item.targetRpe,
              restSeconds: item.restSeconds,
              notes: item.notes,
            })) },
          })) },
        },
        select: { id: true },
      });
      await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.actorId, action: "workout_plan.assigned", entityType: "StudentPlanAssignment", entityId: assignment.id, metadata: { studentMembershipId: membership.id, planId: plan.id } } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.actorId, name: "workout_plan_assigned", properties: { assignmentId: assignment.id, studentMembershipId: membership.id } } }),
      ]);
      const workouts = await tx.assignedWorkout.findMany({ where: { assignmentId: assignment.id }, orderBy: { scheduledOn: "asc" }, include: workoutInclude });
      return { id: assignment.id, workouts: workouts.map(mapWorkout) };
    });
  }

  async listStudentSchedule(input: { workspaceId: string; studentId: string; date: string }) {
    const workouts = await this.database.assignedWorkout.findMany({
      where: { workspaceId: input.workspaceId, studentId: input.studentId, scheduledOn: dateOnly(input.date) },
      orderBy: { createdAt: "asc" },
      include: workoutInclude,
    });
    return workouts.map(mapWorkout);
  }

  async listStudentPlanOverview(input: { workspaceId: string; studentId: string }) {
    const workouts = await this.database.assignedWorkout.findMany({
      where: { workspaceId: input.workspaceId, studentId: input.studentId },
      orderBy: [{ scheduledOn: "asc" }, { createdAt: "asc" }],
      include: workoutInclude,
    });
    return workouts.map(mapWorkout);
  }

  async saveSet(input: SaveSetInput & { workspaceId: string; studentId: string; savedAt: Date }) {
    return serializableTransaction(this.database, async (tx) => {
      const workout = await tx.assignedWorkout.findFirst({
        where: { id: input.assignedWorkoutId, workspaceId: input.workspaceId, studentId: input.studentId, status: { not: "COMPLETED" }, exercises: { some: { id: input.exerciseSnapshotId } } },
        select: { id: true, session: { select: { id: true } } },
      });
      if (!workout) return null;
      const started = !workout.session;
      const session = workout.session ?? await tx.workoutSession.create({ data: { assignedWorkoutId: workout.id, studentId: input.studentId, startedAt: input.savedAt }, select: { id: true } });
      const exerciseLog = await tx.exerciseLog.upsert({
        where: { sessionId_assignedExerciseId: { sessionId: session.id, assignedExerciseId: input.exerciseSnapshotId } },
        create: { sessionId: session.id, assignedExerciseId: input.exerciseSnapshotId },
        update: {}, select: { id: true },
      });
      await tx.setLog.upsert({
        where: { exerciseLogId_setNumber: { exerciseLogId: exerciseLog.id, setNumber: input.setNumber } },
        create: { exerciseLogId: exerciseLog.id, setNumber: input.setNumber, reps: input.reps, weight: input.weight, unit: input.unit, rpe: input.rpe, completed: input.completed, notes: input.notes },
        update: { reps: input.reps, weight: input.weight, unit: input.unit, rpe: input.rpe, completed: input.completed, notes: input.notes },
      });
      await tx.assignedWorkout.update({ where: { id: workout.id }, data: { status: "IN_PROGRESS" } });
      if (started) await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.studentId, action: "workout.started", entityType: "AssignedWorkout", entityId: workout.id } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.studentId, name: "workout_started", properties: { assignedWorkoutId: workout.id } } }),
      ]);
      const saved = await tx.assignedWorkout.findUnique({ where: { id: workout.id }, include: workoutInclude });
      return saved ? mapWorkout(saved) : null;
    });
  }

  async completeWorkout(input: { workspaceId: string; studentId: string; assignedWorkoutId: string; completedAt: Date }) {
    return this.database.$transaction(async (tx) => {
      const workout = await tx.assignedWorkout.findFirst({ where: { id: input.assignedWorkoutId, workspaceId: input.workspaceId, studentId: input.studentId }, select: { id: true, status: true, session: { select: { id: true, startedAt: true, completedAt: true, exerciseLogs: { include: { sets: true } } } } } });
      if (!workout) return null;
      if (workout.status === "COMPLETED" && workout.session?.completedAt) return mapSession(workout.session);
      const session = workout.session
        ? await tx.workoutSession.update({ where: { id: workout.session.id }, data: { status: "COMPLETED", completedAt: input.completedAt }, include: { exerciseLogs: { include: { sets: true } } } })
        : await tx.workoutSession.create({ data: { assignedWorkoutId: workout.id, studentId: input.studentId, status: "COMPLETED", startedAt: input.completedAt, completedAt: input.completedAt }, include: { exerciseLogs: { include: { sets: true } } } });
      const completed = await tx.assignedWorkout.updateMany({ where: { id: workout.id, status: { not: "COMPLETED" } }, data: { status: "COMPLETED" } });
      if (completed.count === 1) await Promise.all([
        tx.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.studentId, action: "workout.completed", entityType: "AssignedWorkout", entityId: workout.id } }),
        tx.productEvent.create({ data: { workspaceId: input.workspaceId, userId: input.studentId, name: "workout_completed", properties: { assignedWorkoutId: workout.id } } }),
      ]);
      return mapSession(session);
    }, { isolationLevel: "Serializable" });
  }

  async listCoachDashboard(input: { workspaceId: string; actorId: string }): Promise<CoachTrainingDashboard> {
    await requireCoach(this.database, input.workspaceId, input.actorId);
    const [exercises, templates, plans, students] = await Promise.all([
      this.database.exercise.findMany({ where: { workspaceId: input.workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      this.database.workoutTemplate.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          exercises: { orderBy: { order: "asc" }, select: { exerciseId: true, order: true, prescribedSets: true, repMin: true, repMax: true, targetRpe: true, restSeconds: true, notes: true, exercise: { select: { name: true } } } },
        },
      }),
      this.database.workoutPlan.findMany({ where: { workspaceId: input.workspaceId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
      this.database.membership.findMany({ where: { workspaceId: input.workspaceId, role: "STUDENT" }, orderBy: { user: { name: "asc" } }, select: { id: true, user: { select: { name: true } } } }),
    ]);
    return {
      exercises,
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        exercises: template.exercises.map((item) => ({ exerciseId: item.exerciseId, exerciseName: item.exercise.name, order: item.order, prescribedSets: item.prescribedSets, repMin: item.repMin, repMax: item.repMax, targetRpe: item.targetRpe === null ? null : Number(item.targetRpe), restSeconds: item.restSeconds, notes: item.notes })),
      })),
      plans,
      students: students.map((student) => ({ membershipId: student.id, name: student.user.name })),
    };
  }
}

async function serializableTransaction<T>(
  database: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isTransactionConflict(error) || attempt === maxAttempts) throw error;
    }
  }
  throw new Error("Unreachable transaction retry state");
}

function isTransactionConflict(error: unknown): error is { code: "P2034" | "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "P2034" || error.code === "P2002");
}

type DatabaseLike = Pick<PrismaClient, "membership" | "user">;

async function requireCoach(database: DatabaseLike, workspaceId: string, actorId: string) {
  if (!await isWorkspaceRoleAuthorized(database, workspaceId, actorId, "COACH")) throw new TrainingAccessDeniedError();
}

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TrainingValidationError("Invalid date");
  return date;
}

function mapWorkout(workout: WorkoutRecord): AssignedWorkout {
  const sets = workout.session?.exerciseLogs.flatMap((log) => log.sets.map((set) => ({
    id: set.id,
    exerciseSnapshotId: log.assignedExerciseId,
    setNumber: set.setNumber,
    reps: set.reps,
    weight: Number(set.weight),
    unit: set.unit,
    rpe: set.rpe === null ? null : Number(set.rpe),
    completed: set.completed,
    notes: set.notes,
  }))) ?? [];
  return {
    id: workout.id,
    workspaceId: workout.workspaceId,
    studentId: workout.studentId,
    scheduledOn: workout.scheduledOn.toISOString().slice(0, 10),
    templateName: workout.templateName,
    status: workout.status,
    exercises: workout.exercises.map((exercise) => ({ id: exercise.id, exerciseId: exercise.sourceExerciseId, exerciseName: exercise.exerciseName, order: exercise.order, prescribedSets: exercise.prescribedSets, repMin: exercise.repMin, repMax: exercise.repMax, targetRpe: exercise.targetRpe === null ? null : Number(exercise.targetRpe), restSeconds: exercise.restSeconds, notes: exercise.notes })),
    session: workout.session ? { id: workout.session.id, startedAt: workout.session.startedAt, completedAt: workout.session.completedAt, sets } : null,
    reviewNotes: workout.session?.reviewNotes ?? [],
  };
}

function mapSession(session: SessionRecord) {
  return {
    id: session.id,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    sets: session.exerciseLogs.flatMap((log) => log.sets.map((set) => ({ id: set.id, exerciseSnapshotId: log.assignedExerciseId, setNumber: set.setNumber, reps: set.reps, weight: Number(set.weight), unit: set.unit, rpe: set.rpe === null ? null : Number(set.rpe), completed: set.completed, notes: set.notes }))),
  };
}
