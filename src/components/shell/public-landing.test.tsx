import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicLanding } from "./public-landing";

describe("PublicLanding", () => {
  it("introduces the coaching workspace and provides a sign-in path", () => {
    render(<PublicLanding />);

    expect(
      screen.getByRole("heading", { name: /cada progreso merece dirección/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /entrar al workspace/i })).toHaveAttribute(
      "href",
      "/workspace",
    );
  });
});
