import { describe, expect, it, vi } from "vitest";
import { InvitationService, type InvitationRepository } from "./invitation-service";

describe("InvitationService", () => {
  it("issues a student invitation and returns the raw token only from creation", async () => {
    const repository: InvitationRepository = {
      createStudentInvitation: vi.fn(async (input) => ({ id: "invite-1", ...input })),
      acceptStudentInvitation: vi.fn(),
      revokeInvitation: vi.fn(),
      listStudentInvitations: vi.fn(),
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
      listStudentInvitations: vi.fn(),
    };
    const service = new InvitationService(repository);

    await expect(service.accept({ userId: "student-1", rawToken: "raw-secret" })).resolves.toEqual({ workspaceSlug: "north" });
    expect(repository.acceptStudentInvitation).toHaveBeenCalledWith(expect.objectContaining({
      userId: "student-1",
      tokenHash: expect.not.stringContaining("raw-secret"),
    }));
  });

  it("lists invitation lifecycle state without exposing token hashes", async () => {
    const repository: InvitationRepository = {
      createStudentInvitation: vi.fn(), acceptStudentInvitation: vi.fn(), revokeInvitation: vi.fn(),
      listStudentInvitations: vi.fn(async () => [
        { id: "active", createdAt: new Date("2026-08-16T10:00:00Z"), expiresAt: new Date("2026-08-20T10:00:00Z"), acceptedAt: null, revokedAt: null },
        { id: "used", createdAt: new Date("2026-08-15T10:00:00Z"), expiresAt: new Date("2026-08-20T10:00:00Z"), acceptedAt: new Date("2026-08-16T11:00:00Z"), revokedAt: null },
        { id: "revoked", createdAt: new Date("2026-08-14T10:00:00Z"), expiresAt: new Date("2026-08-20T10:00:00Z"), acceptedAt: null, revokedAt: new Date("2026-08-16T11:00:00Z") },
        { id: "expired", createdAt: new Date("2026-08-13T10:00:00Z"), expiresAt: new Date("2026-08-15T10:00:00Z"), acceptedAt: null, revokedAt: null },
      ]),
    };
    const service = new InvitationService(repository, { now: () => new Date("2026-08-16T12:00:00Z") });

    const result = await service.list({ actorId: "coach-1", workspaceSlug: "north" });

    expect(result.map(({ status }) => status)).toEqual(["ACTIVE", "USED", "REVOKED", "EXPIRED"]);
    expect(JSON.stringify(result)).not.toMatch(/token/i);
    expect(repository.listStudentInvitations).toHaveBeenCalledWith({ actorId: "coach-1", workspaceSlug: "north" });
  });
});
