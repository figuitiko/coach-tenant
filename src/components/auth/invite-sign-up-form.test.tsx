import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteSignUpForm, type EmailSignUp } from "./invite-sign-up-form";

const callbackUrl = "/invite/abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-";

describe("InviteSignUpForm", () => {
  it("creates an account with invitation proof, exposes loading, and returns to the invite", async () => {
    let finish!: () => void;
    const signUp = vi.fn<EmailSignUp>(() => new Promise((resolve) => {
      finish = () => resolve({ error: null });
    }));
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<InviteSignUpForm callbackUrl={callbackUrl} navigate={navigate} signUp={signUp} />);

    await user.type(screen.getByLabelText(/nombre/i), "New Student");
    await user.type(screen.getByLabelText(/email/i), "student@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(screen.getByRole("button", { name: /creando cuenta/i })).toBeDisabled();
    finish();
    await screen.findByText(/cuenta creada/i);
    expect(signUp).toHaveBeenCalledWith(
      { name: "New Student", email: "student@example.com", password: "correct horse battery staple" },
      "abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-",
    );
    expect(navigate).toHaveBeenCalledWith(callbackUrl);
  });

  it("shows a non-leaky creation error and restores the submit button", async () => {
    const signUp: EmailSignUp = async () => ({ error: { message: "Unique constraint User_email_key" } });
    const user = userEvent.setup();
    render(<InviteSignUpForm callbackUrl={callbackUrl} navigate={() => undefined} signUp={signUp} />);

    await user.type(screen.getByLabelText(/nombre/i), "Existing Student");
    await user.type(screen.getByLabelText(/email/i), "student@example.com");
    await user.type(screen.getByLabelText(/contraseña/i), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos crear la cuenta/i);
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeEnabled();
    expect(screen.queryByText(/unique constraint/i)).not.toBeInTheDocument();
  });
});
