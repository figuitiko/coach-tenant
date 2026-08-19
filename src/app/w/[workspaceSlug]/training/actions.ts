"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { TrainingAccessDeniedError, TrainingValidationError } from "@/modules/training/application/training-service";
import { trainingService } from "@/modules/training/infrastructure/training-use-cases";
import { parseAssignmentForm, parseCompletionForm, parseEditTemplateForm, parseExerciseForm, parsePlanForm, parseSetForm, parseTemplateForm, TrainingFormError } from "@/modules/training/presentation/training-action-input";
import type { TrainingActionState } from "@/modules/training/presentation/training-action-state";

export async function createExerciseAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.createExercise(actor, parseExerciseForm(formData));
  });
}

export async function createTemplateAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    const input = parseTemplateForm(formData);
    await trainingService.createTemplate(actor, {
      name: input.name,
      description: input.description,
      exercises: input.exercises,
    });
  });
}

export async function editTemplateAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.editTemplate(actor, parseEditTemplateForm(formData));
  });
}

export async function createPlanAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.createPlan(actor, parsePlanForm(formData));
  });
}

export async function assignPlanAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.assignSavedPlan(actor, parseAssignmentForm(formData));
  });
}

export async function saveSetAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    await trainingService.saveSet(actor, parseSetForm(formData));
  });
}

export async function completeWorkoutAction(workspaceSlug: string, _previousState: TrainingActionState, formData: FormData) {
  return execute(workspaceSlug, async (actor) => {
    const { assignedWorkoutId } = parseCompletionForm(formData);
    await trainingService.completeWorkout(actor, assignedWorkoutId);
  });
}

async function execute(workspaceSlug: string, operation: (actor: Awaited<ReturnType<typeof actorFor>>) => Promise<void>): Promise<TrainingActionState> {
  try {
    const actor = await actorFor(workspaceSlug);
    await operation(actor);
    revalidatePath(`/w/${workspaceSlug}/training`);
    return { status: "success", message: "Cambios guardados." };
  } catch (error) {
    if (error instanceof TrainingFormError || error instanceof TrainingValidationError || error instanceof TrainingAccessDeniedError || error instanceof CrossTenantAccessError || error instanceof UnauthenticatedError) {
      return { status: "error", message: "No pudimos guardar el entrenamiento. Revisá los datos e intentá de nuevo." };
    }
    throw error;
  }
}

async function actorFor(workspaceSlug: string) {
  const access = await requireWorkspaceAccess(workspaceSlug);
  return { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role };
}
