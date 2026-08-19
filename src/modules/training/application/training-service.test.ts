import { describe, expect, it } from "vitest";
import {
  TrainingAccessDeniedError,
  TrainingService,
  TrainingValidationError,
  type AssignedWorkout,
  type PrescribedExercise,
  type TrainingRepository,
  type WorkoutPlanDraft,
} from "./training-service";

const plan: WorkoutPlanDraft = {
  name: "Base de fuerza",
  startsOn: "2026-08-18",
  endsOn: "2026-08-24",
  workouts: [{
    scheduledOn: "2026-08-18",
    templateId: "template-1",
    templateName: "Día A",
    exercises: [{
      exerciseId: "exercise-1",
      exerciseName: "Sentadilla",
      order: 0,
      prescribedSets: 3,
      repMin: 6,
      repMax: 8,
      targetRpe: 8,
      restSeconds: 120,
      notes: "Controlá la bajada",
    }],
  }],
};

describe("TrainingService authorization", () => {
  it("allows only a coach to create a workspace template", async () => {
    const repository = repositoryFixture();
    const service = new TrainingService(repository);

    await expect(service.createTemplate(
      { actorId: "student-1", workspaceId: "workspace-1", role: "STUDENT" },
      { name: "Día A", exercises: plan.workouts[0].exercises },
    )).rejects.toBeInstanceOf(TrainingAccessDeniedError);
    expect(repository.templates).toHaveLength(0);
  });

  it("denies a guessed workout id from another student or workspace", async () => {
    const repository = repositoryFixture();
    repository.assignments.push(assignmentFixture({ id: "foreign", workspaceId: "workspace-2", studentId: "student-2" }));
    const service = new TrainingService(repository);

    await expect(service.saveSet(
      { actorId: "student-1", workspaceId: "workspace-1", role: "STUDENT" },
      { assignedWorkoutId: "foreign", exerciseSnapshotId: "snapshot-exercise-1", setNumber: 1, reps: 8, weight: 80, unit: "KG", rpe: 8, completed: true },
    )).rejects.toBeInstanceOf(TrainingAccessDeniedError);
  });
});

describe("plan assignment", () => {
  it("rejects non-student and cross-workspace membership targets", async () => {
    const repository = repositoryFixture();
    repository.memberships.set("coach-target", { workspaceId: "workspace-1", role: "COACH" });
    repository.memberships.set("foreign-student", { workspaceId: "workspace-2", role: "STUDENT" });
    const service = new TrainingService(repository);
    const coach = { actorId: "coach-1", workspaceId: "workspace-1", role: "COACH" } as const;

    await expect(service.assignPlan(coach, { studentMembershipId: "coach-target", plan }))
      .rejects.toBeInstanceOf(TrainingValidationError);
    await expect(service.assignPlan(coach, { studentMembershipId: "foreign-student", plan }))
      .rejects.toBeInstanceOf(TrainingAccessDeniedError);
  });

  it("captures an immutable workout snapshot at assignment time", async () => {
    const repository = repositoryFixture();
    repository.memberships.set("student-membership", { workspaceId: "workspace-1", role: "STUDENT", userId: "student-1" });
    const service = new TrainingService(repository);
    const draft = structuredClone(plan);

    const assigned = await service.assignPlan(
      { actorId: "coach-1", workspaceId: "workspace-1", role: "COACH" },
      { studentMembershipId: "student-membership", plan: draft },
    );
    draft.workouts[0].exercises[0].exerciseName = "Sentadilla editada";
    draft.workouts[0].exercises[0].repMax = 12;

    expect(assigned.workouts[0].exercises[0]).toMatchObject({ exerciseName: "Sentadilla", repMax: 8 });
  });

  it("edits a scoped template without changing an existing assignment snapshot", async () => {
    const repository = repositoryFixture();
    repository.memberships.set("student-membership", { workspaceId: "workspace-1", role: "STUDENT", userId: "student-1" });
    const service = new TrainingService(repository);
    const coach = { actorId: "coach-1", workspaceId: "workspace-1", role: "COACH" } as const;
    const originalPlan = structuredClone(plan);
    repository.templates.push({ id: "template-1", name: "Día A", description: null, exercises: structuredClone(originalPlan.workouts[0].exercises) });
    const assigned = await service.assignPlan(coach, { studentMembershipId: "student-membership", plan: originalPlan });

    await service.editTemplate(coach, {
      templateId: "template-1",
      name: "Día A revisado",
      description: "Más volumen para el siguiente bloque",
      exercises: [{ ...originalPlan.workouts[0].exercises[0], order: 2, repMin: 8, repMax: 10 }],
    });

    expect(repository.templates[0]).toMatchObject({ name: "Día A revisado", description: "Más volumen para el siguiente bloque" });
    expect(repository.templates[0].exercises[0]).toMatchObject({ order: 2, repMin: 8, repMax: 10 });
    expect(assigned.workouts[0]).toMatchObject({ templateName: "Día A" });
    expect(assigned.workouts[0].exercises[0]).toMatchObject({ order: 0, repMin: 6, repMax: 8 });
  });
});

describe("student workout logging", () => {
  it("saves actual set data and resumes an incomplete workout", async () => {
    const repository = repositoryFixture();
    repository.assignments.push(assignmentFixture());
    const service = new TrainingService(repository);
    const student = { actorId: "student-1", workspaceId: "workspace-1", role: "STUDENT" } as const;

    await service.saveSet(student, {
      assignedWorkoutId: "assigned-workout-1",
      exerciseSnapshotId: "snapshot-exercise-1",
      setNumber: 1,
      reps: 7,
      weight: 82.5,
      unit: "KG",
      rpe: 8.5,
      completed: false,
      notes: "Me quedaban dos reps",
    });
    const resumed = await service.getStudentSchedule(student, "2026-08-18");

    expect(resumed[0].status).toBe("IN_PROGRESS");
    expect(resumed[0].session?.sets[0]).toMatchObject({ reps: 7, weight: 82.5, unit: "KG", completed: false });
    expect(repository.events.map((event) => event.name)).toContain("workout_started");
  });

  it("finishes a workout idempotently and emits completion once", async () => {
    const repository = repositoryFixture();
    repository.assignments.push(assignmentFixture());
    const service = new TrainingService(repository);
    const student = { actorId: "student-1", workspaceId: "workspace-1", role: "STUDENT" } as const;

    const first = await service.completeWorkout(student, "assigned-workout-1");
    const duplicate = await service.completeWorkout(student, "assigned-workout-1");

    expect(first.completedAt).toEqual(duplicate.completedAt);
    expect(repository.events.filter((event) => event.name === "workout_completed")).toHaveLength(1);
  });
});

function assignmentFixture(overrides: Partial<AssignedWorkout> = {}): AssignedWorkout {
  return {
    id: "assigned-workout-1",
    workspaceId: "workspace-1",
    studentId: "student-1",
    scheduledOn: "2026-08-18",
    templateName: "Día A",
    status: "PLANNED",
    exercises: [{ id: "snapshot-exercise-1", ...plan.workouts[0].exercises[0] }],
    session: null,
    ...overrides,
  };
}

function repositoryFixture(): TrainingRepository & {
  templates: Array<{ id: string; name: string; description?: string | null; exercises: PrescribedExercise[] }>;
  memberships: Map<string, { workspaceId: string; role: "COACH" | "STUDENT"; userId?: string }>;
  assignments: AssignedWorkout[];
  events: { name: string }[];
} {
  const templates: Array<{ id: string; name: string; description?: string | null; exercises: PrescribedExercise[] }> = [];
  const memberships = new Map<string, { workspaceId: string; role: "COACH" | "STUDENT"; userId?: string }>();
  const assignments: AssignedWorkout[] = [];
  const events: { name: string }[] = [];
  return {
    templates,
    memberships,
    assignments,
    events,
    async createExercise(input) { return { id: "exercise-1", ...input }; },
    async createTemplate(input) { templates.push({ id: "template-1", ...structuredClone(input) }); return { id: "template-1", ...input }; },
    async editTemplate(input) {
      const template = templates.find((item) => item.id === input.templateId);
      if (!template || input.workspaceId !== "workspace-1") return null;
      Object.assign(template, { name: input.name, description: input.description, exercises: structuredClone(input.exercises) });
      return { id: template.id, name: template.name };
    },
    async createPlan(input) { return { id: "plan-1", name: input.name }; },
    async findMembership(id) { return memberships.get(id) ?? null; },
    async assignPlan(input) {
      const studentId = memberships.get(input.studentMembershipId)?.userId ?? "student-1";
      const workouts = structuredClone(input.plan.workouts).map((workout, index) => assignmentFixture({
        id: `assigned-workout-${index + 1}`,
        studentId,
        scheduledOn: workout.scheduledOn,
        templateName: workout.templateName,
        exercises: workout.exercises.map((exercise, exerciseIndex) => ({ id: `snapshot-exercise-${exerciseIndex + 1}`, ...exercise })),
      }));
      assignments.push(...workouts);
      return { id: "assignment-1", workouts };
    },
    async assignSavedPlan() { return { id: "assignment-1", workouts: [] }; },
    async listStudentSchedule(input) {
      return assignments.filter((item) => item.workspaceId === input.workspaceId && item.studentId === input.studentId && item.scheduledOn === input.date);
    },
    async saveSet(input) {
      const workout = assignments.find((item) => item.id === input.assignedWorkoutId && item.workspaceId === input.workspaceId && item.studentId === input.studentId);
      if (!workout || !workout.exercises.some((exercise) => exercise.id === input.exerciseSnapshotId)) return null;
      const started = workout.session === null;
      workout.status = "IN_PROGRESS";
      workout.session ??= { id: "session-1", startedAt: new Date("2026-08-18T18:00:00Z"), completedAt: null, sets: [] };
      const existing = workout.session.sets.find((set) => set.exerciseSnapshotId === input.exerciseSnapshotId && set.setNumber === input.setNumber);
      if (existing) Object.assign(existing, input);
      else workout.session.sets.push({ id: `set-${workout.session.sets.length + 1}`, ...input });
      if (started) events.push({ name: "workout_started" });
      return workout;
    },
    async completeWorkout(input) {
      const workout = assignments.find((item) => item.id === input.assignedWorkoutId && item.workspaceId === input.workspaceId && item.studentId === input.studentId);
      if (!workout) return null;
      workout.session ??= { id: "session-1", startedAt: input.completedAt, completedAt: null, sets: [] };
      if (!workout.session.completedAt) {
        workout.session.completedAt = input.completedAt;
        workout.status = "COMPLETED";
        events.push({ name: "workout_completed" });
      }
      return workout.session;
    },
    async listCoachDashboard() { return { exercises: [], templates: [], plans: [], students: [] }; },
  };
}
