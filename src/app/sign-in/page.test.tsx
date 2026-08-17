import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SignInPage from "./page";

describe("SignInPage", () => {
  it("keeps the placeholder form honest until authentication is available", () => {
    render(<SignInPage />);

    expect(screen.queryByRole("link", { name: /ingresar al workspace/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar al workspace/i })).toBeDisabled();
  });
});
