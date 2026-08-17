import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SignInPage from "./page";

describe("SignInPage", () => {
  it("renders a functional credential form", () => {
    render(<SignInPage />);

    expect(screen.getByRole("button", { name: /ingresar al workspace/i })).toBeEnabled();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/contraseña/i)).toBeRequired();
  });
});
