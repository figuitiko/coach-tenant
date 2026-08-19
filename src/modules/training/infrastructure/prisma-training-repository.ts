import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { TrainingAccessDeniedError, TrainingValidationError, type AssignedWorkout, type CoachTrainingDashboard, type PrescribedExercise, type SaveSetInput, type TrainingRepository, type WorkoutPlanDraft } from "../application/training-service";

const workoutInclude = {
  exercises: { orderBy: { order: "asc" as const } },
  session: {
    include: {
      exerciseLogs: { include: { sets: { orderBy: { setNumber: "asc" as const } } } },
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
      return tx.exercise.create({ data: { workspaceId: input.workspaceId, createdById: input.actorId, name: input.name, notes: input.notes }, select: { id: true, name: true } });
    });
  }

  async createTemplate(input: { workspaceId: string; actorId: string; name: string; exercises: PrescribedExercise[] }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const scopedExercises = await tx.exercise.count({ where: { workspaceId: input.workspaceId, id: { in: input.exercises.map((exercise) => exercise.exerciseId) } } });
      if (scopedExercises !== new Set(input.exercises.map((exercise) => exercise.exerciseId)).size) throw new TrainingAccessDeniedError();
      const template = await tx.workoutTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          createdById: input.actorId,
          name: input.name,
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

  async createPlan(input: { workspaceId: string; actorId: string; name: string; startsOn: string; endsOn: string; templateId: string; scheduledOn: string }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const template = await tx.workoutTemplate.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId }, select: { id: true } });
      if (!template) throw new TrainingAccessDeniedError();
      return tx.workoutPlan.create({
        data: {
          workspaceId: input.workspaceId,
          createdById: input.actorId,
          name: input.name,
          startsOn: dateOnly(input.startsOn),
          endsOn: dateOnly(input.endsOn),
          workouts: { create: { templateId: input.templateId, order: 0, scheduledOn: dateOnly(input.scheduledOn) } },
        },
        select: { id: true, name: true },
      });
    });
  }

  findMembership(membershipId: string) {
    return this.database.membership.findUnique({ where: { id: membershipId }, select: { workspaceId: true, role: true, userId: true } });
  }

  async assignPlan(input: { workspaceId: string; actorId: string; studentMembershipId: string; plan: WorkoutPlanDraft }) {
    const savedPlan = await this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const created = await tx.workoutPlan.create({
        data: {
          workspaceId: input.workspaceId,
          createdById: input.actorId,
          name: input.plan.name,
          startsOn: dateOnly(input.plan.startsOn),
          endsOn: dateOnly(input.plan.endsOn),
          workouts: { create: input.plan.workouts.map((workout, order) => ({ templateId: workout.templateId, order, scheduledOn: dateOnly(workout.scheduledOn) })) },
        }, select: { id: true },
      });
      return created.id;
    });
    return this.assignSavedPlan({ ...input, planId: savedPlan });
  }

  async assignSavedPlan(input: { workspaceId: string; actorId: string; studentMembershipId: string; planId: string }) {
    return this.database.$transaction(async (tx) => {
      await requireCoach(tx, input.workspaceId, input.actorId);
      const [membership, plan] = await Promise.all([
        tx.membership.findFirst({ where: { id: input.studentMembershipId, workspaceId: input.workspaceId, role: "STUDENT" }, select: { id: true, userId: true } }),
        tx.workoutPlan.findFirst({
          where: { id: input.planId, workspaceId: input.workspaceId },
          include: { workouts: { orderBy: { order: "asc" }, include: { template: { include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } } } } } } } } },
        }),
      ]);
      if (!membership || !plan) throw new TrainingAccessDeniedError();
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

  async saveSet(input: SaveSetInput & { workspaceId: string; studentId: string; savedAt: Date }) {
    return this.database.$transaction(async (tx) => {
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
      this.database.workoutTemplate.findMany({ where: { workspaceId: input.workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      this.database.workoutPlan.findMany({ where: { workspaceId: input.workspaceId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
      this.database.membership.findMany({ where: { workspaceId: input.workspaceId, role: "STUDENT" }, orderBy: { user: { name: "asc" } }, select: { id: true, user: { select: { name: true } } } }),
    ]);
    return { exercises, templates, plans, students: students.map((student) => ({ membershipId: student.id, name: student.user.name })) };
  }
}

type DatabaseLike = Pick<PrismaClient, "membership">;

async function requireCoach(database: DatabaseLike, workspaceId: string, actorId: string) {
  const membership = await database.membership.findFirst({ where: { workspaceId, userId: actorId, role: "COACH" }, select: { id: true } });
  if (!membership) throw new TrainingAccessDeniedError();
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
