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
});
