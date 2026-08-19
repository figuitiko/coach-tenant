import { describe, expect, it, vi } from "vitest";
import {
  InvitationSignupDeniedError,
  requireAvailableInvitationForSignup,
  type InvitationSignupRepository,
} from "./invitation-signup-guard";

describe("requireAvailableInvitationForSignup", () => {
  it("accepts proof backed by an available invitation without exposing the raw token to persistence", async () => {
    const repository: InvitationSignupRepository = {
      isAvailable: vi.fn(async () => true),
    };
    const now = new Date("2026-08-18T18:00:00.000Z");

    await expect(requireAvailableInvitationForSignup("raw-invitation-token", repository, now)).resolves.toBeUndefined();
    expect(repository.isAvailable).toHaveBeenCalledWith(expect.objectContaining({
      tokenHash: expect.not.stringContaining("raw-invitation-token"),
      now,
    }));
  });

  it("denies missing, expired, revoked, or consumed invitation proof generically", async () => {
    const repository: InvitationSignupRepository = { isAvailable: async () => false };

    await expect(requireAvailableInvitationForSignup("unavailable-token", repository))
      .rejects.toBeInstanceOf(InvitationSignupDeniedError);
    await expect(requireAvailableInvitationForSignup(null, repository))
      .rejects.toBeInstanceOf(InvitationSignupDeniedError);
  });
});
