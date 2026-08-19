import { describe, expect, it } from "vitest";
import { parseEditTemplateForm, parseSetForm, TrainingFormError } from "./training-action-input";

describe("training action validation", () => {
  it("parses an ordered template edit prescription", () => {
    const form = new FormData();
    form.set("templateId", "template-1");
    form.set("name", "Día A revisado");
    form.set("description", "Siguiente bloque");
    form.set("exerciseCount", "1");
    form.set("exerciseId-0", "exercise-1");
    form.set("exerciseName-0", "Sentadilla");
    form.set("order-0", "2");
    form.set("sets-0", "4");
    form.set("repMin-0", "8");
    form.set("repMax-0", "10");
    form.set("targetRpe-0", "8.5");
    form.set("restSeconds-0", "90");
    form.set("notes-0", "Tempo controlado");

    expect(parseEditTemplateForm(form)).toMatchObject({
      templateId: "template-1",
      description: "Siguiente bloque",
      exercises: [{ exerciseId: "exercise-1", order: 2, prescribedSets: 4, repMin: 8, repMax: 10, targetRpe: 8.5 }],
    });
  });

  it("parses decimal actual data without trusting tenant identity from the form", () => {
    const form = new FormData();
    form.set("assignedWorkoutId", "workout-1");
    form.set("exerciseSnapshotId", "snapshot-1");
    form.set("setNumber", "2");
    form.set("reps", "7");
    form.set("weight", "82.5");
    form.set("unit", "KG");
    form.set("rpe", "8.5");
    form.set("completed", "false");

    expect(parseSetForm(form)).toMatchObject({ setNumber: 2, reps: 7, weight: 82.5, rpe: 8.5, completed: false });
    expect(parseSetForm(form)).not.toHaveProperty("workspaceId");
    expect(parseSetForm(form)).not.toHaveProperty("studentId");
  });

  it("rejects malformed or out-of-range set data with a generic form error", () => {
    const form = new FormData();
    form.set("assignedWorkoutId", "workout-1");
    form.set("exerciseSnapshotId", "snapshot-1");
    form.set("setNumber", "0");
    form.set("reps", "not-a-number");
    form.set("weight", "-10");
    form.set("unit", "KG");

    expect(() => parseSetForm(form)).toThrow(TrainingFormError);
  });
});
