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
