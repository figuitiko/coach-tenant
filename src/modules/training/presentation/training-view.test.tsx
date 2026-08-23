import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { initialTrainingActionState } from "./training-action-state";
import { CoachTrainingView, StudentTrainingView } from "./training-view";

const action = async () => initialTrainingActionState;

describe("training views", () => {
  it("gives coaches practical, labelled creation and scheduling forms", () => {
    render(<CoachTrainingView dashboard={{
      exercises: [{ id: "exercise-1", name: "Sentadilla" }],
      templates: [{ id: "template-1", name: "Día A", description: "Fuerza base", exercises: [{ exerciseId: "exercise-1", exerciseName: "Sentadilla", order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 8, restSeconds: 120, notes: null }] }],
      plans: [],
      students: [{ membershipId: "membership-1", name: "Martina López" }],
    }} selectedStudentMembershipId="membership-1" actions={{ createExercise: action, createTemplate: action, editTemplate: action, createPlan: action, assignPlan: action }} />);

    expect(screen.getByRole("heading", { name: /biblioteca de ejercicios/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /crear ejercicio/i })).toBeInTheDocument();
    const createTemplate = screen.getByRole("form", { name: /crear plantilla/i });
    expect(within(createTemplate).getAllByLabelText(/incluir ejercicio/i)).toHaveLength(3);
    const editForm = screen.getByRole("form", { name: /editar plantilla día a/i });
    expect(within(editForm).getByLabelText(/descripción/i)).toHaveValue("Fuerza base");
    expect(within(editForm).getAllByLabelText(/orden/i)[0]).toHaveValue(0);
    expect(within(editForm).getByLabelText(/mantener ejercicio 1/i)).toBeChecked();
    expect(within(editForm).getByLabelText(/agregar ejercicio/i)).not.toBeChecked();
    const planForm = screen.getByRole("form", { name: /programar plan/i });
    expect(within(planForm).getAllByLabelText(/incluir entrenamiento/i)).toHaveLength(3);
    expect(screen.getByRole("form", { name: /asignar plan/i })).toBeInTheDocument();
    expect(screen.getByText(/asignando a martina lópez/i)).toBeVisible();
    expect(screen.getAllByText(/^paso [1-4]$/i)).toHaveLength(4);
  });

  it("shows the assigned plan overview and discoverable date navigation", () => {
    const workout = {
      id: "assigned-workout-1", workspaceId: "workspace-1", studentId: "student-1", scheduledOn: "2026-08-21",
      templateName: "Torso", status: "PLANNED" as const, exercises: [], session: null,
      reviewNotes: [{ id: "note-1", body: "Buen ritmo", reply: null }],
    };
    render(<StudentTrainingView date="2026-08-21" workouts={[workout]} overview={[workout]} actions={{ saveSet: action, completeWorkout: action, replyToReview: action }} />);

    expect(screen.getByRole("heading", { name: /tu plan asignado/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /abrir torso/i })).toHaveAttribute("href", "?date=2026-08-21#workout-assigned-workout-1");
    expect(screen.getByRole("link", { name: /día anterior/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /día siguiente/i })).toBeVisible();
    expect(screen.getByText("Buen ritmo")).toBeVisible();
    expect(screen.getByRole("form", { name: /responder a la devolución/i })).toBeVisible();
  });

  it("renders a mobile-friendly daily schedule and actual set logger", () => {
    render(<StudentTrainingView date="2026-08-18" workouts={[{
      id: "assigned-workout-1",
      workspaceId: "workspace-1",
      studentId: "student-1",
      scheduledOn: "2026-08-18",
      templateName: "Día A",
      status: "IN_PROGRESS",
      exercises: [{ id: "snapshot-exercise-1", exerciseId: "exercise-1", exerciseName: "Sentadilla", order: 0, prescribedSets: 3, repMin: 6, repMax: 8, targetRpe: 8, restSeconds: 120, notes: null }],
      session: { id: "session-1", startedAt: new Date("2026-08-18T18:00:00Z"), completedAt: null, sets: [] },
    }]} actions={{ saveSet: action, completeWorkout: action, replyToReview: action }} />);

    const logger = screen.getByRole("form", { name: /registrar serie 1 de sentadilla/i });
    const metrics = within(logger).getByRole("group", { name: /métricas de la serie/i });
    expect(metrics).toHaveClass("grid-cols-1", "sm:grid-cols-4");
    for (const field of [/repeticiones reales/i, /peso real/i, /unidad/i, /rpe real/i]) {
      expect(within(metrics).getByLabelText(field).closest("label")).toHaveClass("row-span-2", "grid-rows-subgrid");
    }
    expect(within(logger).getByLabelText(/repeticiones reales/i)).toHaveAttribute("inputmode", "numeric");
    expect(within(logger).getByLabelText(/peso real/i)).toHaveAttribute("inputmode", "decimal");
    expect(within(logger).getByLabelText(/serie completada/i)).not.toBeChecked();
    expect(within(logger).getByRole("button", { name: /guardar serie/i })).toHaveClass("min-h-12");
    expect(screen.getByRole("button", { name: /finalizar entrenamiento/i })).toHaveClass("min-h-12");
  });

  it("announces action feedback and disables repeat submission while pending", async () => {
    let resolveAction!: (state: typeof initialTrainingActionState) => void;
    const pendingAction = () => new Promise<typeof initialTrainingActionState>((resolve) => { resolveAction = resolve; });
    const user = userEvent.setup();
    render(<CoachTrainingView dashboard={{ exercises: [], templates: [], plans: [], students: [] }} actions={{
      createExercise: pendingAction,
      createTemplate: action,
      editTemplate: action,
      createPlan: action,
      assignPlan: action,
    }} />);
    const form = screen.getByRole("form", { name: /crear ejercicio/i });
    await user.type(within(form).getByLabelText(/nombre/i), "Sentadilla");
    await user.click(within(form).getByRole("button", { name: /guardar ejercicio/i }));

    expect(within(form).getByRole("button", { name: /guardando/i })).toBeDisabled();
    expect(within(form).getByRole("status")).toHaveAttribute("aria-live", "polite");
    resolveAction({ status: "success", message: "Cambios guardados." });
  });
});
