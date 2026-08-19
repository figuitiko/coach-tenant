import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoachReviewView, StudentProgressView } from "./progress-view";

const action = vi.fn(async () => ({ status: "success" as const, message: "Guardado" }));

describe("progress views", () => {
  it("renders a mobile-first labelled metrics form with announced state and repeat-submit protection", () => {
    render(<StudentProgressView draft={{ id: "draft-1", status: "DRAFT", metrics: {}, notes: null, photos: [] }} history={[]} actions={{ saveDraft: action, submit: action, requestUpload: action, attachPhoto: action }} />);
    expect(screen.getByRole("heading", { name: /tu progreso/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^peso$/i)).toHaveAttribute("inputmode", "decimal");
    expect(screen.getAllByRole("status").every(node => node.getAttribute("aria-live") === "polite")).toBe(true);
    expect(screen.getByRole("button", { name: /enviar check-in/i })).toBeEnabled();
  });

  it("uses accessible queue and review-detail semantics", () => {
    render(<CoachReviewView queue={[{ kind: "WORKOUT", id: "workout-1", studentId: "s", studentName: "Ana", submittedAt: new Date("2026-08-19") }]} detail={null} reviewAction={action} />);
    expect(screen.getByRole("heading", { name: /cola de revisión/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /pendientes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /revisar entrenamiento de ana/i })).toBeInTheDocument();
  });
});
