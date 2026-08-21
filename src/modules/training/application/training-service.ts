import { isCalendarDate } from "../presentation/local-date";

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

export type PlanScheduleInput = {
  name: string;
  startsOn: string;
  endsOn: string;
  workouts: Array<{ templateId: string; scheduledOn: string; order: number }>;
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
  reviewNotes?: Array<{ id: string; body: string; reply: { body: string } | null }>;
};

export type CoachTrainingDashboard = {
  exercises: Array<{ id: string; name: string }>;
  templates: Array<{ id: string; name: string; description: string | null; exercises: PrescribedExercise[] }>;
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
  createTemplate(input: { workspaceId: string; actorId: string; name: string; description?: string | null; exercises: PrescribedExercise[] }): Promise<{ id: string; name: string }>;
  editTemplate(input: { workspaceId: string; actorId: string; templateId: string; name: string; description: string | null; exercises: PrescribedExercise[] }): Promise<{ id: string; name: string } | null>;
  createPlan(input: PlanScheduleInput & { workspaceId: string; actorId: string }): Promise<{ id: string; name: string } | null>;
  findMembership(membershipId: string): Promise<{ workspaceId: string; role: TrainingRole; userId?: string } | null>;
  assignSavedPlan(input: { workspaceId: string; actorId: string; studentMembershipId: string; planId: string }): Promise<{ id: string; workouts: AssignedWorkout[] } | null>;
  listStudentSchedule(input: { workspaceId: string; studentId: string; date: string }): Promise<AssignedWorkout[]>;
  listStudentPlanOverview(input: { workspaceId: string; studentId: string }): Promise<AssignedWorkout[]>;
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

  async createTemplate(actor: TrainingActor, input: { name: string; description?: string | null; exercises: PrescribedExercise[] }) {
    requireCoach(actor);
    if (!input.exercises.length) throw new TrainingValidationError("A template needs an exercise");
    input.exercises.forEach(validatePrescription);
    return this.repository.createTemplate({
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      name: requiredText(input.name, "Template name is required"),
      description: optionalText(input.description),
      exercises: structuredClone(input.exercises),
    });
  }

  async editTemplate(actor: TrainingActor, input: { templateId: string; name: string; description?: string | null; exercises: PrescribedExercise[] }) {
    requireCoach(actor);
    if (!input.templateId || !input.exercises.length) throw new TrainingValidationError("A template needs an exercise");
    input.exercises.forEach(validatePrescription);
    const updated = await this.repository.editTemplate({
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      templateId: input.templateId,
      name: requiredText(input.name, "Template name is required"),
      description: optionalText(input.description),
      exercises: structuredClone(input.exercises),
    });
    if (!updated) throw new TrainingAccessDeniedError();
    return updated;
  }

  async createPlan(actor: TrainingActor, input: PlanScheduleInput) {
    requireCoach(actor);
    validateSchedule(input);
    const plan = await this.repository.createPlan({ workspaceId: actor.workspaceId, actorId: actor.actorId, ...structuredClone(input), name: input.name.trim() });
    if (!plan) throw new TrainingAccessDeniedError();
    return plan;
  }

  async assignSavedPlan(actor: TrainingActor, input: { studentMembershipId: string; planId: string }) {
    requireCoach(actor);
    const membership = await this.repository.findMembership(input.studentMembershipId);
    if (!membership || membership.workspaceId !== actor.workspaceId) throw new TrainingAccessDeniedError();
    if (membership.role !== "STUDENT") throw new TrainingValidationError("Plans can only be assigned to students");
    const assignment = await this.repository.assignSavedPlan({ workspaceId: actor.workspaceId, actorId: actor.actorId, ...input });
    if (!assignment) throw new TrainingAccessDeniedError();
    return assignment;
  }

  async getCoachDashboard(actor: TrainingActor) {
    requireCoach(actor);
    return this.repository.listCoachDashboard({ workspaceId: actor.workspaceId, actorId: actor.actorId });
  }

  async getStudentSchedule(actor: TrainingActor, date: string) {
    requireStudent(actor);
    if (!isCalendarDate(date)) throw new TrainingValidationError("Invalid schedule date");
    return this.repository.listStudentSchedule({ workspaceId: actor.workspaceId, studentId: actor.actorId, date });
  }

  async getStudentPlanOverview(actor: TrainingActor) {
    requireStudent(actor);
    return this.repository.listStudentPlanOverview({ workspaceId: actor.workspaceId, studentId: actor.actorId });
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

function validateSchedule(plan: PlanScheduleInput) {
  requiredText(plan.name, "Plan name is required");
  if (!isCalendarDate(plan.startsOn) || !isCalendarDate(plan.endsOn) || plan.endsOn < plan.startsOn) throw new TrainingValidationError("Plan dates are invalid");
  if (!plan.workouts.length) throw new TrainingValidationError("A plan needs a scheduled workout");
  const orders = new Set<number>();
  for (const workout of plan.workouts) {
    if (!workout.templateId || !isCalendarDate(workout.scheduledOn) || workout.scheduledOn < plan.startsOn || workout.scheduledOn > plan.endsOn || !Number.isInteger(workout.order) || workout.order < 0 || orders.has(workout.order)) throw new TrainingValidationError("Scheduled workout is invalid");
    orders.add(workout.order);
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
