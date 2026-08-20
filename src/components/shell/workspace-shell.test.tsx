import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

describe("WorkspaceShell", () => {
  it("offers primary navigation to mobile users", () => {
    render(<WorkspaceShell />);

    const navigation = screen.getByRole("navigation", { name: /navegación móvil/i });
    expect(within(navigation).getAllByRole("link")).toHaveLength(4);
    expect(within(navigation).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "Alumnos" })).toHaveAttribute("href", "/w/fuerza-norte/students");
    expect(within(navigation).getByRole("link", { name: "Entrenamiento" })).toHaveAttribute("href", "/w/fuerza-norte/training");
    expect(within(navigation).getByRole("link", { name: "Revisiones" })).toHaveAttribute("href", "/w/fuerza-norte/progress");
  });

  it("shows a tenant-scoped coach roster summary and a calm empty state", () => {
    const { rerender } = render(<WorkspaceShell students={[{ id: "s-1", name: "Ana", status: "Al día" }]} />);
    expect(screen.getByRole("heading", { name: /alumnos/i })).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();

    rerender(<WorkspaceShell students={[]} />);
    expect(screen.getByText(/todavía no hay alumnos/i)).toBeInTheDocument();
  });

  it("offers a workspace switch affordance for multi-membership accounts", () => {
    render(
      <WorkspaceShell
        currentMembership={{ workspaceId: "w-1", workspaceSlug: "north", workspaceName: "North", timeZone: "America/Mexico_City", role: "COACH" }}
        memberships={[
          { workspaceId: "w-1", workspaceSlug: "north", workspaceName: "North", timeZone: "America/Mexico_City", role: "COACH" },
          { workspaceId: "w-2", workspaceSlug: "south", workspaceName: "South", timeZone: "America/Mexico_City", role: "STUDENT" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /cambiar a south/i })).toHaveAttribute("href", "/w/south");
  });
});
