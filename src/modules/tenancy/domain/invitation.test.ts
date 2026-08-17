import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  acceptInvitation,
  issueInvitation,
  InvitationUnavailableError,
  revokeInvitation,
} from "./invitation";

const NOW = new Date("2026-08-16T18:00:00.000Z");

describe("invitation lifecycle", () => {
  it("returns a cryptographically generated raw token once and stores only its SHA-256 hash", () => {
    const issued = issueInvitation({
      workspaceId: "workspace-1",
      invitedById: "coach-1",
      expiresAt: new Date("2026-08-17T18:00:00.000Z"),
      now: NOW,
      generateToken: () => "one-time-secret",
    });

    expect(issued.rawToken).toBe("one-time-secret");
    expect(issued.invitation.tokenHash).toBe(
      createHash("sha256").update("one-time-secret").digest("hex"),
    );
    expect(issued.invitation).not.toHaveProperty("rawToken");
    expect(issued.invitation.role).toBe("STUDENT");
  });

  it("rejects expired invitations", () => {
    const { invitation } = invitationFixture({ expiresAt: new Date("2026-08-16T17:59:59.000Z") });

    expect(() => acceptInvitation(invitation, "student-1", NOW)).toThrow(
      InvitationUnavailableError,
    );
  });

  it("accepts an invitation once and rejects a second use", () => {
    const { invitation } = invitationFixture();
    const accepted = acceptInvitation(invitation, "student-1", NOW);

    expect(accepted.acceptedById).toBe("student-1");
    expect(accepted.acceptedAt).toEqual(NOW);
    expect(() => acceptInvitation(accepted, "student-2", NOW)).toThrow(
      InvitationUnavailableError,
    );
  });

  it("rejects revoked invitations", () => {
    const { invitation } = invitationFixture();

    expect(() => acceptInvitation(revokeInvitation(invitation, NOW), "student-1", NOW)).toThrow(
      InvitationUnavailableError,
    );
  });

  it("is idempotent for a user who is already a workspace member", () => {
    const { invitation } = invitationFixture();

    const accepted = acceptInvitation(invitation, "student-1", NOW);
    expect(accepted.acceptedById).toBe("student-1");
  });
});

function invitationFixture(overrides: { expiresAt?: Date } = {}) {
  return issueInvitation({
    workspaceId: "workspace-1",
    invitedById: "coach-1",
    expiresAt: overrides.expiresAt ?? new Date("2026-08-17T18:00:00.000Z"),
    now: new Date("2026-08-15T18:00:00.000Z"),
    generateToken: () => "fixture-token",
  });
}
