import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoachStudentsView } from "./coach-students-view";

describe("CoachStudentsView", () => {
  it("creates a one-time invite link and revokes active invitations with accessible feedback", async () => {
    const createInvitation = vi.fn(async () => ({ ok: true as const, invitation: { id: "new", rawToken: "raw-once", expiresAt: new Date("2026-08-27T12:00:00Z") } }));
    const revokeInvitation = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(<CoachStudentsView workspaceSlug="north" students={[]} invitations={[{ id: "active", status: "ACTIVE", createdAt: "2026-08-20T12:00:00Z", expiresAt: "2026-08-27T12:00:00Z" }]} createInvitation={createInvitation} revokeInvitation={revokeInvitation} />);

    await user.type(screen.getByLabelText(/vence/i), "2026-08-27T12:00");
    await user.click(screen.getByRole("button", { name: /generar invitación/i }));
    const oneTime = await screen.findByRole("status");
    expect(within(oneTime).getByText(/invite\/raw-once/i)).toBeVisible();
    expect(screen.getByText(/se muestra una sola vez/i)).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: /revocar/i })[1]);
    expect(revokeInvitation).toHaveBeenCalledWith("active");
    expect(await screen.findByText(/invitación revocada/i)).toBeVisible();
  });

  it("shows lifecycle statuses but never renders stored tokens", () => {
    render(<CoachStudentsView workspaceSlug="north" students={[]} invitations={[
      { id: "used", status: "USED", createdAt: "2026-08-19T12:00:00Z", expiresAt: "2026-08-27T12:00:00Z" },
      { id: "revoked", status: "REVOKED", createdAt: "2026-08-18T12:00:00Z", expiresAt: "2026-08-27T12:00:00Z" },
    ]} createInvitation={vi.fn()} revokeInvitation={vi.fn()} />);
    expect(screen.getByText("Usada")).toBeVisible();
    expect(screen.getByText("Revocada")).toBeVisible();
    expect(document.body.textContent).not.toMatch(/token|hash/i);
  });
});
