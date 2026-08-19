import { z } from "zod";

export class TrainingFormError extends Error {
  constructor() {
    super("No pudimos validar los datos del entrenamiento");
    this.name = "TrainingFormError";
  }
}

const requiredId = z.string().trim().min(1).max(120);
const requiredName = z.string().trim().min(1).max(120);
const optionalNotes = z.string().trim().max(500).transform((value) => value || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalNumber = z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().nullable());

export function parseExerciseForm(formData: FormData) {
  return parse(z.object({ name: requiredName, notes: optionalNotes }), formData);
}

export function parseTemplateForm(formData: FormData) {
  return parse(z.object({
    name: requiredName,
    description: optionalNotes,
    exerciseId: requiredId,
    sets: z.coerce.number().int().min(1).max(20),
    repMin: z.coerce.number().int().min(1).max(100),
    repMax: z.coerce.number().int().min(1).max(100),
    targetRpe: optionalNumber.pipe(z.number().min(1).max(10).nullable()),
    restSeconds: optionalNumber.pipe(z.number().int().min(0).max(3600).nullable()),
    notes: optionalNotes,
  }), formData);
}

export function parseEditTemplateForm(formData: FormData) {
  const header = parse(z.object({
    templateId: requiredId,
    name: requiredName,
    description: optionalNotes,
    exerciseCount: z.coerce.number().int().min(1).max(30),
  }), formData);
  const exerciseSchema = z.object({
    exerciseId: requiredId,
    exerciseName: requiredName,
    order: z.coerce.number().int().min(0).max(100),
    prescribedSets: z.coerce.number().int().min(1).max(20),
    repMin: z.coerce.number().int().min(1).max(100),
    repMax: z.coerce.number().int().min(1).max(100),
    targetRpe: optionalNumber.pipe(z.number().min(1).max(10).nullable()),
    restSeconds: optionalNumber.pipe(z.number().int().min(0).max(3600).nullable()),
    notes: optionalNotes,
  });
  const exercises = Array.from({ length: header.exerciseCount }, (_, index) => {
    const parsed = exerciseSchema.safeParse({
      exerciseId: formData.get(`exerciseId-${index}`),
      exerciseName: formData.get(`exerciseName-${index}`),
      order: formData.get(`order-${index}`),
      prescribedSets: formData.get(`sets-${index}`),
      repMin: formData.get(`repMin-${index}`),
      repMax: formData.get(`repMax-${index}`),
      targetRpe: formData.get(`targetRpe-${index}`),
      restSeconds: formData.get(`restSeconds-${index}`),
      notes: formData.get(`notes-${index}`),
    });
    if (!parsed.success) throw new TrainingFormError();
    return parsed.data;
  });
  return { templateId: header.templateId, name: header.name, description: header.description, exercises };
}

export function parsePlanForm(formData: FormData) {
  return parse(z.object({ name: requiredName, startsOn: date, endsOn: date, templateId: requiredId, scheduledOn: date }), formData);
}

export function parseAssignmentForm(formData: FormData) {
  return parse(z.object({ planId: requiredId, studentMembershipId: requiredId }), formData);
}

export function parseSetForm(formData: FormData) {
  return parse(z.object({
    assignedWorkoutId: requiredId,
    exerciseSnapshotId: requiredId,
    setNumber: z.coerce.number().int().min(1).max(20),
    reps: z.coerce.number().int().min(0).max(200),
    weight: z.coerce.number().min(0).max(2000),
    unit: z.enum(["KG", "LB"]),
    rpe: optionalNumber.pipe(z.number().min(1).max(10).nullable()),
    completed: z.string().transform((value) => value === "true"),
    notes: z.string().trim().max(500).optional().transform((value) => value || null),
  }), formData);
}

export function parseCompletionForm(formData: FormData) {
  return parse(z.object({ assignedWorkoutId: requiredId }), formData);
}

function parse<T extends z.ZodType>(schema: T, formData: FormData): z.output<T> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new TrainingFormError();
  return parsed.data;
}
