import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

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

  it("labels explicit super-admin context separately from tenant coach context", () => {
    render(<WorkspaceShell currentMembership={{ ...defaultAdminMembership }} memberships={[defaultAdminMembership]} />);

    expect(screen.getAllByText(/panel de super admin/i).length).toBeGreaterThan(0);
  });

  it.each([
    ["ordinary coach", {
      workspaceId: "w-coach",
      workspaceSlug: "north",
      workspaceName: "North",
      timeZone: "America/Mexico_City",
      role: "COACH" as const,
      accessMode: "MEMBERSHIP" as const,
    }, 4],
    ["student", {
      workspaceId: "w-student",
      workspaceSlug: "north",
      workspaceName: "North",
      timeZone: "America/Mexico_City",
      role: "STUDENT" as const,
      accessMode: "MEMBERSHIP" as const,
    }, 3],
    ["super admin", defaultAdminMembership, 4],
  ] as const)("places logout last in desktop and mobile dashboard navigation for %s", (_label, membership, linkCount) => {
    render(<WorkspaceShell currentMembership={membership} memberships={[membership]} />);

    for (const navigation of screen.getAllByRole("navigation")) {
      expect(within(navigation).getAllByRole("link")).toHaveLength(linkCount);
      const logout = within(navigation).getByRole("button", { name: "Cerrar sesión" });
      expect(navigation.lastElementChild).toBe(logout);
    }

    const mobile = screen.getByRole("navigation", { name: /navegación móvil/i });
    expect(mobile).toHaveStyle({ gridTemplateColumns: `repeat(${linkCount + 1}, minmax(0, 1fr))` });
  });
});

const defaultAdminMembership = {
  workspaceId: "w-admin",
  workspaceSlug: "north",
  workspaceName: "North",
  timeZone: "America/Mexico_City",
  role: "COACH" as const,
  accessMode: "SUPER_ADMIN" as const,
};
