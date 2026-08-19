import { describe, expect, it } from "vitest";
import { parseSetForm, TrainingFormError } from "./training-action-input";

describe("training action validation", () => {
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
