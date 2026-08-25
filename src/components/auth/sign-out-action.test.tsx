import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutAction, type SignOut } from "./sign-out-action";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("SignOutAction", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
  });

  it("locks duplicate requests, exposes pending state, and redirects after success", async () => {
    let finish!: () => void;
    const signOut = vi.fn<SignOut>(() => new Promise((resolve) => {
      finish = () => resolve({ error: null });
    }));
    const user = userEvent.setup();
    render(<SignOutAction signOut={signOut} variant="topbar" />);

    const idle = screen.getByRole("button", { name: "Cerrar sesión" });
    await user.click(idle);

    const pending = screen.getByRole("button", { name: "Cerrando sesión…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending).toHaveAttribute("aria-busy", "true");
    await user.click(pending);
    expect(signOut).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(replace).toHaveBeenCalledWith("/sign-in");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["error response", async () => ({ error: { message: "Internal database detail" } })],
    ["rejected request", async () => { throw new Error("Network detail"); }],
  ])("retains the current route and announces a non-leaky error for a %s", async (_case, signOut) => {
    const user = userEvent.setup();
    render(<SignOutAction signOut={signOut} variant="mobile" />);

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cerrar tu sesión. Intentá de nuevo.");
    expect(alert).toHaveClass("col-span-full");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/database detail|network detail/i)).not.toBeInTheDocument();
  });

  it("clears an earlier error before retrying", async () => {
    let attempt = 0;
    let finishRetry!: () => void;
    const signOut: SignOut = () => {
      attempt += 1;
      if (attempt === 1) return Promise.resolve({ error: { message: "failed" } });
      return new Promise((resolve) => {
        finishRetry = () => resolve({ error: null });
      });
    };
    const user = userEvent.setup();
    render(<SignOutAction signOut={signOut} variant="sidebar" />);

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    finishRetry();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });
});
