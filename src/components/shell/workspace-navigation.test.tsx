import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceNavigation } from "./workspace-navigation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("WorkspaceNavigation", () => {
  it.each([
    ["COACH", 4],
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
});
