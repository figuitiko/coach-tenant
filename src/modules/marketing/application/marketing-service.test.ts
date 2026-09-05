import { describe, expect, it, vi } from "vitest";
import { MarketingAccessDeniedError, MarketingConflictError, MarketingValidationError } from "../domain/errors";
import { MarketingService, type MarketingActor, type MarketingLandingRepository } from "./marketing-service";
import type { LandingContentInput } from "../domain/contracts";

const coach: MarketingActor = { actorId: "coach-a", workspaceId: "workspace-a", role: "COACH" };
const student: MarketingActor = { actorId: "student-a", workspaceId: "workspace-a", role: "STUDENT" };
const superAdminWithoutContext: MarketingActor = {
  actorId: "admin-a",
  workspaceId: "workspace-a",
  role: "SUPER_ADMIN",
};
const superAdminWithContext: MarketingActor = {
  actorId: "admin-a",
  workspaceId: "workspace-a",
  role: "SUPER_ADMIN",
  accessMode: "WORKSPACE",
};

const validDraft: LandingContentInput = {
  themeKey: "editorial",
  coachDisplayName: " Fuerza Norte ",
  heroHeadline: " Entrená con dirección ",
  heroSubheadline: "Un plan simple para volver a moverte mejor.",
  ctaHeading: "Hablemos por WhatsApp",
  whatsappDigits: "+54 11 1234 5678",
  whatsappMessage: "Hola, quiero empezar",
  services: [{ title: "Online", description: "Plan semanal" }],
};

function repositoryStub(overrides: Partial<MarketingLandingRepository> = {}): MarketingLandingRepository {
  return {
    getEditor: vi.fn(),
    saveDraft: vi.fn(async () => ({
      landingId: "landing-a",
      revisionId: "revision-a",
      revisionNumber: 1,
      publishedRevisionId: null,
    })),
    previewRevision: vi.fn(),
    publishLanding: vi.fn(async () => ({
      landingId: "landing-a",
      revisionId: "revision-a",
      revisionNumber: 1,
      publishedAt: new Date("2026-09-05T12:00:00.000Z"),
    })),
    unpublishLanding: vi.fn(async () => ({ landingId: "landing-a", unpublished: true as const })),
    ...overrides,
  };
}

describe("MarketingService landing authoring", () => {
  it("allows coaches to save incomplete drafts after normalization", async () => {
    const repository = repositoryStub();
    const service = new MarketingService(repository);

    await expect(
      service.saveDraft(coach, { content: { ...validDraft, heroHeadline: "" }, idempotencyKey: "draft-1" }),
    ).resolves.toMatchObject({ revisionNumber: 1 });

    expect(repository.saveDraft).toHaveBeenCalledWith(
      coach,
      expect.objectContaining({
        idempotencyKey: "draft-1",
        content: expect.objectContaining({
          coachDisplayName: "Fuerza Norte",
          whatsappDigits: "541112345678",
          heroHeadline: null,
        }),
      }),
    );
  });

  it("rejects student authoring before the repository is called", async () => {
    const repository = repositoryStub();
    const service = new MarketingService(repository);

    await expect(service.saveDraft(student, { content: validDraft, idempotencyKey: "draft-1" })).rejects.toBeInstanceOf(
      MarketingAccessDeniedError,
    );

    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it("requires explicit workspace context for super-admin landing mutations", async () => {
    const repository = repositoryStub();
    const service = new MarketingService(repository);

    await expect(
      service.saveDraft(superAdminWithoutContext, { content: validDraft, idempotencyKey: "draft-1" }),
    ).rejects.toBeInstanceOf(MarketingAccessDeniedError);
    await expect(
      service.saveDraft(superAdminWithContext, { content: validDraft, idempotencyKey: "draft-1" }),
    ).resolves.toMatchObject({ revisionId: "revision-a" });
  });

  it("validates publication completeness separately from draft saving", async () => {
    const repository = repositoryStub();
    const service = new MarketingService(repository);

    await expect(
      service.publishLanding(coach, {
        revisionId: "revision-a",
        expectedRevisionNumber: 1,
        content: { ...validDraft, whatsappDigits: "" },
        idempotencyKey: "publish-1",
      }),
    ).rejects.toBeInstanceOf(MarketingValidationError);
    await expect(
      service.publishLanding(coach, {
        revisionId: "revision-a",
        expectedRevisionNumber: 1,
        content: validDraft,
        idempotencyKey: "publish-1",
      }),
    ).resolves.toMatchObject({ revisionId: "revision-a" });
  });

  it("surfaces repository stale revision conflicts", async () => {
    const repository = repositoryStub({
      saveDraft: vi.fn(async () => {
        throw new MarketingConflictError("Stale landing revision");
      }),
    });
    const service = new MarketingService(repository);

    await expect(
      service.saveDraft(coach, { content: validDraft, expectedRevisionNumber: 3, idempotencyKey: "draft-2" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
