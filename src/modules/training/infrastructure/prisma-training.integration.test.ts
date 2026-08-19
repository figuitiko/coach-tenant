import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { TrainingAccessDeniedError, TrainingService } from "../application/training-service";
import { PrismaTrainingRepository } from "./prisma-training-repository";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

integration("PrismaTrainingRepository against PostgreSQL", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const repository = new PrismaTrainingRepository(database);
  const now = new Date("2026-08-18T18:00:00.000Z");
  const service = new TrainingService(repository, () => now);
  const suffix = Date.now();
  let coachId: string;
  let studentId: string;
  let workspaceId: string;
  let otherWorkspaceId: string;

  beforeAll(async () => {
    const coach = await database.user.create({ data: { name: "Coach Integration", email: `training-coach-${suffix}@example.test` } });
    const student = await database.user.create({ data: { name: "Student Integration", email: `training-student-${suffix}@example.test` } });
    const workspace = await database.workspace.create({ data: { name: "Training Integration", slug: `training-${suffix}`, ownerId: coach.id } });
    const other = await database.workspace.create({ data: { name: "Other Integration", slug: `training-other-${suffix}`, ownerId: coach.id } });
    await database.membership.createMany({ data: [
      { workspaceId: workspace.id, userId: coach.id, role: "COACH" },
      { workspaceId: workspace.id, userId: student.id, role: "STUDENT" },
      { workspaceId: other.id, userId: coach.id, role: "COACH" },
      { workspaceId: other.id, userId: student.id, role: "STUDENT" },
    ] });
    coachId = coach.id;
    studentId = student.id;
    workspaceId = workspace.id;
    otherWorkspaceId = other.id;
  });

  afterAll(async () => {
    if (workspaceId && otherWorkspaceId) await database.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWorkspaceId] } } });
    if (coachId && studentId) await database.user.deleteMany({ where: { id: { in: [coachId, studentId] } } });
    await database.$disconnect();
  });

  it("keeps assignment snapshots immutable, scopes guessed ids, resumes sets, and completes once", async () => {
    const coach = { actorId: coachId, workspaceId, role: "COACH" } as const;
    const student = { actorId: studentId, workspaceId, role: "STUDENT" } as const;
    const exercise = await service.createExercise(coach, { name: "Sentadilla integración" });
    const template = await service.createTemplate(coach, { name: "Día integración", exercises: [{ exerciseId: exercise.id, exerciseName: exercise.name, order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 8, restSeconds: 120, notes: null }] });
    const plan = await service.createPlan(coach, { name: "Bloque integración", startsOn: "2026-08-18", endsOn: "2026-08-24", workouts: [{ templateId: template.id, scheduledOn: "2026-08-18", order: 0 }] });
    const membership = await database.membership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId, userId: studentId } } });
    const assignment = await service.assignSavedPlan(coach, { planId: plan.id, studentMembershipId: membership.id });
    const workout = assignment.workouts[0];

    await service.editTemplate(coach, {
      templateId: template.id,
      name: "Día integración editado",
      description: "Próximo bloque",
      exercises: [{ exerciseId: exercise.id, exerciseName: exercise.name, order: 2, prescribedSets: 4, repMin: 8, repMax: 12, targetRpe: 9, restSeconds: 90, notes: "Nueva receta" }],
    });
    expect(await database.workoutTemplate.findUnique({ where: { id: template.id }, select: { name: true, description: true } }))
      .toEqual({ name: "Día integración editado", description: "Próximo bloque" });
    const immutable = (await service.getStudentSchedule(student, "2026-08-18"))[0];
    expect(immutable.exercises[0]).toMatchObject({ exerciseName: "Sentadilla integración", repMax: 8 });

    await expect(service.saveSet({ ...student, workspaceId: otherWorkspaceId }, { assignedWorkoutId: workout.id, exerciseSnapshotId: workout.exercises[0].id, setNumber: 1, reps: 7, weight: 80, unit: "KG", rpe: 8, completed: false }))
      .rejects.toBeInstanceOf(TrainingAccessDeniedError);
    await service.saveSet(student, { assignedWorkoutId: workout.id, exerciseSnapshotId: workout.exercises[0].id, setNumber: 1, reps: 7, weight: 80, unit: "KG", rpe: 8, completed: false });
    expect((await service.getStudentSchedule(student, "2026-08-18"))[0].session?.sets[0].reps).toBe(7);
    await service.completeWorkout(student, workout.id);
    await service.completeWorkout(student, workout.id);

    expect(await database.productEvent.count({ where: { workspaceId, name: "workout_template_created" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "exercise_created" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "workout_plan_created" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "workout_template_updated" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "workout_plan_assigned" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "workout_started" } })).toBe(1);
    expect(await database.productEvent.count({ where: { workspaceId, name: "workout_completed" } })).toBe(1);
  });
});
