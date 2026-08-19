"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { TrainingAccessDeniedError, TrainingValidationError } from "@/modules/training/application/training-service";
import { trainingService } from "@/modules/training/infrastructure/training-use-cases";
import { parseAssignmentForm, parseCompletionForm, parseExerciseForm, parsePlanForm, parseSetForm, parseTemplateForm, TrainingFormError } from "@/modules/training/presentation/training-action-input";

export async function createExerciseAction(workspaceSlug: string, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.createExercise(actor, parseExerciseForm(formData));
  });
}

export async function createTemplateAction(workspaceSlug: string, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    const input = parseTemplateForm(formData);
    await trainingService.createTemplate(actor, {
      name: input.name,
      exercises: [{ exerciseId: input.exerciseId, exerciseName: "Ejercicio", order: 0, prescribedSets: input.sets, repMin: input.repMin, repMax: input.repMax, targetRpe: input.targetRpe, restSeconds: input.restSeconds, notes: input.notes }],
    });
  });
}

export async function createPlanAction(workspaceSlug: string, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.createPlan(actor, parsePlanForm(formData));
  });
}

export async function assignPlanAction(workspaceSlug: string, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.assignSavedPlan(actor, parseAssignmentForm(formData));
  });
}

export async function saveSetAction(workspaceSlug: string, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.saveSet(actor, parseSetForm(formData));
  });
}

export async function completeWorkoutAction(workspaceSlug: string, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    const { assignedWorkoutId } = parseCompletionForm(formData);
    await trainingService.completeWorkout(actor, assignedWorkoutId);
  });
}

async function execute(workspaceSlug: string, operation: (actor: Awaited<ReturnType<typeof actorFor>>) => Promise<void>) {
  try {
    const actor = await actorFor(workspaceSlug);
    await operation(actor);
    revalidatePath(`/w/${workspaceSlug}/training`);
  } catch (error) {
    if (error instanceof TrainingFormError || error instanceof TrainingValidationError || error instanceof TrainingAccessDeniedError) {
      throw new Error("No pudimos guardar el entrenamiento. Revisá los datos e intentá de nuevo.");
    }
    throw error;
  }
}

async function actorFor(workspaceSlug: string) {
  const access = await requireWorkspaceAccess(workspaceSlug);
  return { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role };
}
