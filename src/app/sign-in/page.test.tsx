import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SignInPage from "./page";

describe("SignInPage", () => {
  it("renders a functional credential form without open registration", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("button", { name: /ingresar al workspace/i })).toBeEnabled();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/contraseña/i)).toBeRequired();
    expect(screen.queryByRole("button", { name: /crear cuenta/i })).not.toBeInTheDocument();
  });

  it("offers account creation only for an invitation callback", async () => {
    render(await SignInPage({
      searchParams: Promise.resolve({
        callbackURL: "/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-",
      }),
    }));

    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /ingresar al workspace/i })).toBeEnabled();
  });
});
