import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceNavigation } from "./workspace-navigation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("WorkspaceNavigation", () => {
  it.each([
    ["COACH", 5],
    ["STUDENT", 3],
  ] as const)("places logout last in desktop and mobile navigation for %s", (role, linkCount) => {
    render(<WorkspaceNavigation role={role} workspaceSlug="fuerza-norte" />);

    for (const navigation of screen.getAllByRole("navigation")) {
      expect(within(navigation).getAllByRole("link")).toHaveLength(linkCount);
      const logout = within(navigation).getByRole("button", { name: "Cerrar sesión" });
      expect(navigation.lastElementChild).toBe(logout);
    }

    const mobile = screen.getByRole("navigation", { name: /navegación móvil del workspace/i });
    expect(mobile).toHaveStyle({ gridTemplateColumns: `repeat(${linkCount + 1}, minmax(0, 1fr))` });
  });
  it("shows landing navigation only to coaches", () => {
    const { rerender } = render(<WorkspaceNavigation role="COACH" workspaceSlug="fuerza-norte" />);
    expect(screen.getAllByRole("link", { name: "Landing" })[0]).toHaveAttribute("href", "/w/fuerza-norte/landing");

    rerender(<WorkspaceNavigation role="STUDENT" workspaceSlug="fuerza-norte" />);
    expect(screen.queryByRole("link", { name: "Landing" })).not.toBeInTheDocument();
  });
});
