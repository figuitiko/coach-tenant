export type TrainingRole = "COACH" | "STUDENT";
export type WeightUnit = "KG" | "LB";
export type WorkoutStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export type TrainingActor = { actorId: string; workspaceId: string; role: TrainingRole };

export type PrescribedExercise = {
  exerciseId: string;
  exerciseName: string;
  order: number;
  prescribedSets: number;
  repMin: number;
  repMax: number;
  targetRpe: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type WorkoutPlanDraft = {
  name: string;
  startsOn: string;
  endsOn: string;
  workouts: Array<{
    scheduledOn: string;
    templateId: string;
    templateName: string;
    exercises: PrescribedExercise[];
  }>;
};

export type LoggedSet = {
  id: string;
  exerciseSnapshotId: string;
  setNumber: number;
  reps: number;
  weight: number;
  unit: WeightUnit;
  rpe: number | null;
  completed: boolean;
  notes?: string | null;
};

export type WorkoutSessionDto = {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  sets: LoggedSet[];
};

export type AssignedWorkout = {
  id: string;
  workspaceId: string;
  studentId: string;
  scheduledOn: string;
  templateName: string;
  status: WorkoutStatus;
  exercises: Array<PrescribedExercise & { id: string }>;
  session: WorkoutSessionDto | null;
};

export type CoachTrainingDashboard = {
  exercises: Array<{ id: string; name: string }>;
  templates: Array<{ id: string; name: string }>;
  plans: Array<{ id: string; name: string }>;
  students: Array<{ membershipId: string; name: string }>;
};

export type SaveSetInput = {
  assignedWorkoutId: string;
  exerciseSnapshotId: string;
  setNumber: number;
  reps: number;
  weight: number;
  unit: WeightUnit;
  rpe: number | null;
  completed: boolean;
  notes?: string | null;
};

export interface TrainingRepository {
  createExercise(input: { workspaceId: string; actorId: string; name: string; notes: string | null }): Promise<{ id: string; name: string }>;
  createTemplate(input: { workspaceId: string; actorId: string; name: string; exercises: PrescribedExercise[] }): Promise<{ id: string; name: string }>;
  createPlan(input: { workspaceId: string; actorId: string; name: string; startsOn: string; endsOn: string; templateId: string; scheduledOn: string }): Promise<{ id: string; name: string }>;
  findMembership(membershipId: string): Promise<{ workspaceId: string; role: TrainingRole; userId?: string } | null>;
  assignPlan(input: { workspaceId: string; actorId: string; studentMembershipId: string; plan: WorkoutPlanDraft }): Promise<{ id: string; workouts: AssignedWorkout[] }>;
  assignSavedPlan(input: { workspaceId: string; actorId: string; studentMembershipId: string; planId: string }): Promise<{ id: string; workouts: AssignedWorkout[] }>;
  listStudentSchedule(input: { workspaceId: string; studentId: string; date: string }): Promise<AssignedWorkout[]>;
  saveSet(input: SaveSetInput & { workspaceId: string; studentId: string; savedAt: Date }): Promise<AssignedWorkout | null>;
  completeWorkout(input: { workspaceId: string; studentId: string; assignedWorkoutId: string; completedAt: Date }): Promise<WorkoutSessionDto | null>;
  listCoachDashboard(input: { workspaceId: string; actorId: string }): Promise<CoachTrainingDashboard>;
}

export class TrainingAccessDeniedError extends Error {
  constructor() {
    super("Training resource unavailable");
    this.name = "TrainingAccessDeniedError";
  }
}

export class TrainingValidationError extends Error {
  constructor(message = "Training data is invalid") {
    super(message);
    this.name = "TrainingValidationError";
  }
}

export class TrainingService {
  constructor(
    private readonly repository: TrainingRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createExercise(actor: TrainingActor, input: { name: string; notes?: string | null }) {
    requireCoach(actor);
    const name = requiredText(input.name, "Exercise name is required");
    return this.repository.createExercise({ ...actor, name, notes: optionalText(input.notes) });
  }

  async createTemplate(actor: TrainingActor, input: { name: string; exercises: PrescribedExercise[] }) {
    requireCoach(actor);
    if (!input.exercises.length) throw new TrainingValidationError("A template needs an exercise");
    input.exercises.forEach(validatePrescription);
    return this.repository.createTemplate({
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      name: requiredText(input.name, "Template name is required"),
      exercises: structuredClone(input.exercises),
    });
  }

  async assignPlan(actor: TrainingActor, input: { studentMembershipId: string; plan: WorkoutPlanDraft }) {
    requireCoach(actor);
    validatePlan(input.plan);
    const membership = await this.repository.findMembership(input.studentMembershipId);
    if (!membership || membership.workspaceId !== actor.workspaceId) throw new TrainingAccessDeniedError();
    if (membership.role !== "STUDENT") throw new TrainingValidationError("Plans can only be assigned to students");
    return this.repository.assignPlan({
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      studentMembershipId: input.studentMembershipId,
      plan: structuredClone(input.plan),
    });
  }

  async createPlan(actor: TrainingActor, input: { name: string; startsOn: string; endsOn: string; templateId: string; scheduledOn: string }) {
    requireCoach(actor);
    validatePlan({ ...input, workouts: [{ scheduledOn: input.scheduledOn, templateId: input.templateId, templateName: "snapshot pending", exercises: [validPlaceholderPrescription] }] });
    return this.repository.createPlan({ workspaceId: actor.workspaceId, actorId: actor.actorId, ...input, name: input.name.trim() });
  }

  async assignSavedPlan(actor: TrainingActor, input: { studentMembershipId: string; planId: string }) {
    requireCoach(actor);
    const membership = await this.repository.findMembership(input.studentMembershipId);
    if (!membership || membership.workspaceId !== actor.workspaceId) throw new TrainingAccessDeniedError();
    if (membership.role !== "STUDENT") throw new TrainingValidationError("Plans can only be assigned to students");
    return this.repository.assignSavedPlan({ workspaceId: actor.workspaceId, actorId: actor.actorId, ...input });
  }

  async getCoachDashboard(actor: TrainingActor) {
    requireCoach(actor);
    return this.repository.listCoachDashboard({ workspaceId: actor.workspaceId, actorId: actor.actorId });
  }

  async getStudentSchedule(actor: TrainingActor, date: string) {
    requireStudent(actor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TrainingValidationError("Invalid schedule date");
    return this.repository.listStudentSchedule({ workspaceId: actor.workspaceId, studentId: actor.actorId, date });
  }

  async saveSet(actor: TrainingActor, input: SaveSetInput) {
    requireStudent(actor);
    validateSet(input);
    const workout = await this.repository.saveSet({ ...input, workspaceId: actor.workspaceId, studentId: actor.actorId, savedAt: this.now() });
    if (!workout) throw new TrainingAccessDeniedError();
    return workout;
  }

  async completeWorkout(actor: TrainingActor, assignedWorkoutId: string) {
    requireStudent(actor);
    const session = await this.repository.completeWorkout({
      workspaceId: actor.workspaceId,
      studentId: actor.actorId,
      assignedWorkoutId,
      completedAt: this.now(),
    });
    if (!session) throw new TrainingAccessDeniedError();
    return session;
  }
}

const validPlaceholderPrescription: PrescribedExercise = {
  exerciseId: "validation-placeholder",
  exerciseName: "validation-placeholder",
  order: 0,
  prescribedSets: 1,
  repMin: 1,
  repMax: 1,
  targetRpe: null,
  restSeconds: null,
  notes: null,
};

function requireCoach(actor: TrainingActor) {
  if (actor.role !== "COACH") throw new TrainingAccessDeniedError();
}

function requireStudent(actor: TrainingActor) {
  if (actor.role !== "STUDENT") throw new TrainingAccessDeniedError();
}

function requiredText(value: string, message: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) throw new TrainingValidationError(message);
  return normalized;
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  if (normalized && normalized.length > 500) throw new TrainingValidationError("Notes are too long");
  return normalized || null;
}

function validatePrescription(input: PrescribedExercise) {
  if (!input.exerciseId || !input.exerciseName.trim()) throw new TrainingValidationError("Exercise is required");
  if (!Number.isInteger(input.order) || input.order < 0) throw new TrainingValidationError("Exercise order is invalid");
  if (!Number.isInteger(input.prescribedSets) || input.prescribedSets < 1 || input.prescribedSets > 20) throw new TrainingValidationError("Set count is invalid");
  if (!Number.isInteger(input.repMin) || !Number.isInteger(input.repMax) || input.repMin < 1 || input.repMax < input.repMin || input.repMax > 100) throw new TrainingValidationError("Rep range is invalid");
  if (input.targetRpe !== null && (input.targetRpe < 1 || input.targetRpe > 10)) throw new TrainingValidationError("Target RPE is invalid");
  if (input.restSeconds !== null && (!Number.isInteger(input.restSeconds) || input.restSeconds < 0 || input.restSeconds > 3600)) throw new TrainingValidationError("Rest time is invalid");
}

function validatePlan(plan: WorkoutPlanDraft) {
  requiredText(plan.name, "Plan name is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(plan.endsOn) || plan.endsOn < plan.startsOn) throw new TrainingValidationError("Plan dates are invalid");
  if (!plan.workouts.length) throw new TrainingValidationError("A plan needs a scheduled workout");
  for (const workout of plan.workouts) {
    if (workout.scheduledOn < plan.startsOn || workout.scheduledOn > plan.endsOn) throw new TrainingValidationError("Workout date is outside the plan");
    if (!workout.templateId || !workout.exercises.length) throw new TrainingValidationError("Scheduled workout is invalid");
    workout.exercises.forEach(validatePrescription);
  }
}

function validateSet(input: SaveSetInput) {
  if (!input.assignedWorkoutId || !input.exerciseSnapshotId) throw new TrainingValidationError();
  if (!Number.isInteger(input.setNumber) || input.setNumber < 1 || input.setNumber > 20) throw new TrainingValidationError("Set number is invalid");
  if (!Number.isInteger(input.reps) || input.reps < 0 || input.reps > 200) throw new TrainingValidationError("Actual reps are invalid");
  if (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > 2000) throw new TrainingValidationError("Actual weight is invalid");
  if (input.rpe !== null && (!Number.isFinite(input.rpe) || input.rpe < 1 || input.rpe > 10)) throw new TrainingValidationError("Actual RPE is invalid");
  optionalText(input.notes);
}
