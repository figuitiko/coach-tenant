import { describe, expect, it, vi } from "vitest";
import { InvitationService, type InvitationRepository } from "./invitation-service";

describe("InvitationService", () => {
  it("issues a student invitation and returns the raw token only from creation", async () => {
    const repository: InvitationRepository = {
      createStudentInvitation: vi.fn(async (input) => ({ id: "invite-1", ...input })),
      acceptStudentInvitation: vi.fn(),
      revokeInvitation: vi.fn(),
    };
    const service = new InvitationService(repository, {
      now: () => new Date("2026-08-16T18:00:00.000Z"),
      generateToken: () => "raw-secret",
    });

    const result = await service.create({
      actorId: "coach-1",
      workspaceSlug: "north",
      expiresAt: new Date("2026-08-17T18:00:00.000Z"),
    });

    expect(result).toEqual({ id: "invite-1", rawToken: "raw-secret", expiresAt: new Date("2026-08-17T18:00:00.000Z") });
    expect(repository.createStudentInvitation).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "coach-1",
      workspaceSlug: "north",
      tokenHash: expect.not.stringContaining("raw-secret"),
      role: "STUDENT",
    }));
  });

  it("hashes a raw token before passing acceptance to persistence", async () => {
    const repository: InvitationRepository = {
      createStudentInvitation: vi.fn(),
      acceptStudentInvitation: vi.fn(async () => ({ workspaceSlug: "north" })),
      revokeInvitation: vi.fn(),
    };
    const service = new InvitationService(repository);

    await expect(service.accept({ userId: "student-1", rawToken: "raw-secret" })).resolves.toEqual({ workspaceSlug: "north" });
    expect(repository.acceptStudentInvitation).toHaveBeenCalledWith(expect.objectContaining({
      userId: "student-1",
      tokenHash: expect.not.stringContaining("raw-secret"),
    }));
  });
});
