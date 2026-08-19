import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoachTrainingView, StudentTrainingView } from "./training-view";

describe("training views", () => {
  it("gives coaches practical, labelled creation and scheduling forms", () => {
    render(<CoachTrainingView dashboard={{
      exercises: [{ id: "exercise-1", name: "Sentadilla" }],
      templates: [{ id: "template-1", name: "Día A" }],
      plans: [],
      students: [{ membershipId: "membership-1", name: "Martina López" }],
    }} actions={{ createExercise: async () => {}, createTemplate: async () => {}, createPlan: async () => {}, assignPlan: async () => {} }} />);

    expect(screen.getByRole("heading", { name: /biblioteca de ejercicios/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /crear ejercicio/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /crear plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /programar plan/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: /asignar plan/i })).toBeInTheDocument();
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
    }]} actions={{ saveSet: async () => {}, completeWorkout: async () => {} }} />);

    const logger = screen.getByRole("form", { name: /registrar serie 1 de sentadilla/i });
    expect(within(logger).getByLabelText(/repeticiones reales/i)).toHaveAttribute("inputmode", "numeric");
    expect(within(logger).getByLabelText(/peso real/i)).toHaveAttribute("inputmode", "decimal");
    expect(within(logger).getByRole("button", { name: /guardar y seguir después/i })).toHaveClass("min-h-12");
    expect(screen.getByRole("button", { name: /finalizar entrenamiento/i })).toHaveClass("min-h-12");
  });
});
