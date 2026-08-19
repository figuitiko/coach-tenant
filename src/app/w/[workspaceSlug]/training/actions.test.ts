import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingAccessDeniedError } from "@/modules/training/application/training-service";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
  createExercise: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modules/tenancy/infrastructure/workspace-dal", () => ({ requireWorkspaceAccess: mocks.requireWorkspaceAccess }));
vi.mock("@/modules/training/infrastructure/training-use-cases", () => ({
  trainingService: {
    createExercise: mocks.createExercise,
    createTemplate: vi.fn(),
    editTemplate: vi.fn(),
    createPlan: vi.fn(),
    assignSavedPlan: vi.fn(),
    saveSet: vi.fn(),
    completeWorkout: vi.fn(),
  },
}));

import { initialTrainingActionState } from "@/modules/training/presentation/training-action-state";
import { createExerciseAction } from "./actions";

describe("training server action state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorkspaceAccess.mockResolvedValue({
      userId: "coach-1",
      workspace: { workspaceId: "workspace-1", workspaceSlug: "north", workspaceName: "North", timeZone: "America/Mexico_City", role: "COACH" },
    });
  });

  it("returns an announced generic error state for expected validation failures", async () => {
    const form = new FormData();
    form.set("name", "");
    form.set("notes", "");

    await expect(createExerciseAction("north", initialTrainingActionState, form)).resolves.toEqual({
      status: "error",
      message: "No pudimos guardar el entrenamiento. Revisá los datos e intentá de nuevo.",
    });
  });

  it("does not expose authorization details in expected action failures", async () => {
    mocks.createExercise.mockRejectedValue(new TrainingAccessDeniedError());
    const form = new FormData();
    form.set("name", "Sentadilla");
    form.set("notes", "");

    const state = await createExerciseAction("north", initialTrainingActionState, form);
    expect(state.status).toBe("error");
    expect(state.message).not.toMatch(/access|authorization|resource/i);
  });
});
