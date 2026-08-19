import { describe, expect, it } from "vitest";
import { parseEditTemplateForm, parsePlanForm, parseSetForm, parseTemplateForm, TrainingFormError } from "./training-action-input";

describe("training action validation", () => {
  it("parses an ordered template edit prescription", () => {
    const form = new FormData();
    form.set("templateId", "template-1");
    form.set("name", "Día A revisado");
    form.set("description", "Siguiente bloque");
    form.set("exerciseCount", "1");
    form.set("include-0", "true");
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

  it("supports multiple template exercises and removes unchecked edit rows", () => {
    const create = prescriptionForm("Crear múltiple", 2);
    create.set("include-0", "true");
    create.set("include-1", "true");
    expect(parseTemplateForm(create).exercises).toHaveLength(2);

    const edit = prescriptionForm("Editar múltiple", 2);
    edit.set("templateId", "template-1");
    edit.set("include-1", "true");
    expect(parseEditTemplateForm(edit).exercises).toEqual([expect.objectContaining({ exerciseId: "exercise-2", order: 1 })]);
  });

  it("parses multiple dated workouts in a plan", () => {
    const form = new FormData();
    form.set("name", "Semana doble");
    form.set("startsOn", "2026-08-18");
    form.set("endsOn", "2026-08-24");
    form.set("workoutCount", "2");
    form.set("includeWorkout-0", "true");
    form.set("templateId-0", "template-1");
    form.set("scheduledOn-0", "2026-08-18");
    form.set("includeWorkout-1", "true");
    form.set("templateId-1", "template-2");
    form.set("scheduledOn-1", "2026-08-21");

    expect(parsePlanForm(form).workouts).toEqual([
      { templateId: "template-1", scheduledOn: "2026-08-18", order: 0 },
      { templateId: "template-2", scheduledOn: "2026-08-21", order: 1 },
    ]);
  });

  it("rejects calendar-shaped but impossible dates", () => {
    const form = new FormData();
    form.set("name", "Fecha imposible");
    form.set("startsOn", "2026-02-30");
    form.set("endsOn", "2026-03-02");
    form.set("workoutCount", "1");
    form.set("includeWorkout-0", "true");
    form.set("templateId-0", "template-1");
    form.set("scheduledOn-0", "2026-03-01");

    expect(() => parsePlanForm(form)).toThrow(TrainingFormError);
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

  it("parses a checked set as completed", () => {
    const form = new FormData();
    form.set("assignedWorkoutId", "workout-1");
    form.set("exerciseSnapshotId", "snapshot-1");
    form.set("setNumber", "1");
    form.set("reps", "8");
    form.set("weight", "80");
    form.set("unit", "KG");
    form.set("completed", "true");

    expect(parseSetForm(form).completed).toBe(true);
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

function prescriptionForm(name: string, count: number) {
  const form = new FormData();
  form.set("name", name);
  form.set("description", "Descripción");
  form.set("exerciseCount", String(count));
  for (let index = 0; index < count; index += 1) {
    form.set(`exerciseId-${index}`, `exercise-${index + 1}`);
    form.set(`exerciseName-${index}`, `Ejercicio ${index + 1}`);
    form.set(`order-${index}`, String(index));
    form.set(`sets-${index}`, "3");
    form.set(`repMin-${index}`, "6");
    form.set(`repMax-${index}`, "8");
    form.set(`targetRpe-${index}`, "8");
    form.set(`restSeconds-${index}`, "90");
    form.set(`notes-${index}`, "");
  }
  return form;
}
