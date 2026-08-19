import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignInForm, type EmailSignIn } from "./sign-in-form";

describe("SignInForm", () => {
  it("submits email/password, exposes loading, and routes successful users to workspace entry", async () => {
    let finish!: () => void;
    const signIn = vi.fn<EmailSignIn>(() => new Promise((resolve) => {
      finish = () => resolve({ error: null });
    }));
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<SignInForm navigate={navigate} signIn={signIn} />);

    await user.type(screen.getByLabelText(/email/i), "coach@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: /ingresar al workspace/i }));

    expect(screen.getByRole("button", { name: /ingresando/i })).toBeDisabled();
    finish();
    await screen.findByText(/acceso confirmado/i);
    expect(signIn).toHaveBeenCalledWith({ email: "coach@example.com", password: "correct horse battery staple" });
    expect(navigate).toHaveBeenCalledWith("/workspace");
  });

  it("shows a non-leaky error and restores the submit button", async () => {
    const signIn: EmailSignIn = async () => ({ error: { message: "Database says user missing" } });
    const user = userEvent.setup();
    render(<SignInForm navigate={() => undefined} signIn={signIn} />);

    await user.type(screen.getByLabelText(/email/i), "unknown@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "not-the-password");
    await user.click(screen.getByRole("button", { name: /ingresar al workspace/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos iniciar sesión/i);
    expect(screen.getByRole("button", { name: /ingresar al workspace/i })).toBeEnabled();
    expect(screen.queryByText(/database says/i)).not.toBeInTheDocument();
  });

  it("preserves an explicitly validated invitation callback", async () => {
    const navigate = vi.fn();
    const signIn: EmailSignIn = async () => ({ error: null });
    const user = userEvent.setup();
    const callbackUrl = "/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-";
    render(<SignInForm callbackUrl={callbackUrl} navigate={navigate} signIn={signIn} />);

    await user.type(screen.getByLabelText(/email/i), "student@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: /ingresar al workspace/i }));

    expect(navigate).toHaveBeenCalledWith(callbackUrl);
  });
});
