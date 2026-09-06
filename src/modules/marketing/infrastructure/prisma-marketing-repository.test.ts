import { describe, expect, it, vi } from "vitest";
import {
  MarketingAccessDeniedError,
  MarketingConflictError,
  MarketingNotFoundError,
  MarketingValidationError,
} from "../domain/errors";
import { PrismaMarketingRepository } from "./prisma-marketing-repository";
import type { LandingContentInput } from "../domain/contracts";
import type { MarketingActor } from "../application/marketing-service";

const coach: MarketingActor = { actorId: "coach-a", workspaceId: "workspace-a", role: "COACH" };
const student: MarketingActor = { actorId: "student-a", workspaceId: "workspace-a", role: "STUDENT" };
const foreignCoach: MarketingActor = { actorId: "coach-a", workspaceId: "workspace-a", role: "COACH" };
const admin: MarketingActor = {
  actorId: "admin-a",
  workspaceId: "workspace-a",
  role: "SUPER_ADMIN",
  accessMode: "WORKSPACE",
};

const content: LandingContentInput & { themeKey: "editorial"; resultAttributionMode: "ANONYMOUS" } = {
  themeKey: "editorial",
  coachDisplayName: "Fuerza Norte",
  heroHeadline: "Entrená con dirección",
  heroSubheadline: "Un plan simple para volver a moverte mejor.",
  ctaHeading: "Hablemos por WhatsApp",
  whatsappDigits: "541112345678",
  whatsappMessage: "Hola, quiero empezar",
  resultAttributionMode: "ANONYMOUS",
  services: [{ title: "Online", description: "Plan semanal" }],
};

function createTransaction() {
  const state = {
    landing: null as null | {
      id: string;
      workspaceId: string;
      currentDraftRevisionId: string | null;
      publishedRevisionId: string | null;
      currentDraftRevision?: ({ id?: string; revisionNumber: number } & Partial<LandingContentInput>) | null;
    },
    revisionCount: 0,
  };
  return {
    state,
    membership: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === "workspace-a" && where.userId === "coach-a" && where.role === "COACH"
          ? { id: "membership-a" }
          : null,
      ),
    },
    user: {
      findFirst: vi.fn(async ({ where }) =>
        where.id === "admin-a" && where.platformRole === "SUPER_ADMIN" ? { id: "admin-a" } : null,
      ),
    },
    auditEvent: {
      findUnique: vi.fn(async (): Promise<unknown> => null),
      create: vi.fn(async ({ data }) => ({ id: "audit-a", ...data })),
    },
    productEvent: { create: vi.fn(async ({ data }) => ({ id: "event-a", ...data })) },
    coachLanding: {
      findUnique: vi.fn(async () => state.landing),
      upsert: vi.fn(async () => {
        state.landing ??= {
          id: "landing-a",
          workspaceId: "workspace-a",
          currentDraftRevisionId: null,
          publishedRevisionId: null,
          currentDraftRevision: null,
        };
        return state.landing;
      }),
      update: vi.fn(async ({ data }) => {
        if (!state.landing) throw new Error("missing landing");
        state.landing = { ...state.landing, ...data };
        return state.landing;
      }),
    },
    coachLandingRevision: {
      create: vi.fn(async ({ data }) => ({ id: `revision-${data.revisionNumber}`, ...data })),
      findFirst: vi.fn(async ({ where }) =>
        where.id === "revision-foreign"
          ? null
          : { id: where.id, workspaceId: "workspace-a", landingId: "landing-a", revisionNumber: 1, ...content },
      ),
    },
    marketingAsset: { count: vi.fn(async () => 0) },
    studentResultVersion: { count: vi.fn(async () => 0) },
    landingProgram: { create: vi.fn(async ({ data }) => ({ id: `program-${data.order}`, ...data })) },
    landingMethodStep: { create: vi.fn(async ({ data }) => ({ id: `step-${data.order}`, ...data })) },
    landingFaq: { create: vi.fn(async ({ data }) => ({ id: `faq-${data.order}`, ...data })) },
    landingRevisionResult: { create: vi.fn(async ({ data }) => ({ id: `selection-${data.order}`, ...data })) },
  };
}

function createDatabase(tx = createTransaction()) {
  return {
    tx,
    database: { $transaction: vi.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)) },
  };
}

describe("PrismaMarketingRepository landing mutations", () => {
  it("creates one landing revision, advances the draft pointer, and writes audit/product events atomically", async () => {
    const { tx, database } = createDatabase();
    const repository = new PrismaMarketingRepository(database as never);

    await expect(repository.saveDraft(coach, { content, idempotencyKey: "save-1" })).resolves.toMatchObject({
      landingId: "landing-a",
      revisionId: "revision-1",
      revisionNumber: 1,
    });

    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.membership.findFirst).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-a", userId: "coach-a", role: "COACH" },
      select: { id: true },
    });
    expect(tx.coachLanding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "workspace-a" },
        create: { workspaceId: "workspace-a" },
        update: {},
      }),
    );
    expect(tx.coachLandingRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revisionNumber: 1,
          workspaceId: "workspace-a",
          createdById: "coach-a",
          mutationKey: expect.stringContaining("saveDraft:save-1"),
        }),
      }),
    );
    expect(tx.coachLanding.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentDraftRevisionId: "revision-1" } }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "marketing.landing.draft_saved",
          entityType: "CoachLandingRevision",
          entityId: "revision-1",
        }),
      }),
    );
    expect(tx.productEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "marketing_landing_draft_saved" }) }),
    );
  });

  it("returns the original outcome on same-key same-payload replay without duplicating revisions or events", async () => {
    const tx = createTransaction();
    tx.auditEvent.findUnique.mockResolvedValueOnce({
      metadata: {
        payloadHash: "fixed-hash",
        output: { landingId: "landing-a", revisionId: "revision-1", revisionNumber: 1, publishedRevisionId: null },
      },
    });
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never, () => "fixed-hash");

    await expect(repository.saveDraft(coach, { content, idempotencyKey: "save-1" })).resolves.toEqual({
      landingId: "landing-a",
      revisionId: "revision-1",
      revisionNumber: 1,
      publishedRevisionId: null,
    });

    expect(tx.coachLandingRevision.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    expect(tx.productEvent.create).not.toHaveBeenCalled();
  });

  it("rejects same-key different-payload replay", async () => {
    const tx = createTransaction();
    tx.auditEvent.findUnique.mockResolvedValueOnce({
      metadata: { payloadHash: "different-hash", output: { revisionId: "revision-1" } },
    });
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never, () => "fixed-hash");

    await expect(repository.saveDraft(coach, { content, idempotencyKey: "save-1" })).rejects.toBeInstanceOf(
      MarketingConflictError,
    );
  });

  it("prevents stale saves from overwriting a newer draft revision", async () => {
    const tx = createTransaction();
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-4",
      publishedRevisionId: null,
      currentDraftRevision: { revisionNumber: 4 },
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.saveDraft(coach, { content, expectedRevisionNumber: 3, idempotencyKey: "save-stale" }),
    ).rejects.toBeInstanceOf(MarketingConflictError);
    expect(tx.coachLandingRevision.create).not.toHaveBeenCalled();
  });

  it("fails closed for guessed foreign preview revision IDs", async () => {
    const tx = createTransaction();
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(repository.previewRevision(foreignCoach, { revisionId: "revision-foreign" })).rejects.toBeInstanceOf(
      MarketingNotFoundError,
    );
    expect(tx.coachLandingRevision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "revision-foreign", workspaceId: "workspace-a", landing: { workspaceId: "workspace-a" } },
      }),
    );
  });

  it("validates the persisted draft before publishing instead of trusting caller content", async () => {
    const tx = createTransaction();
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-incomplete",
      publishedRevisionId: "revision-live",
      currentDraftRevision: {
        ...content,
        id: "revision-incomplete",
        revisionNumber: 2,
        whatsappDigits: "",
      },
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.publishLanding(coach, {
        revisionId: "revision-incomplete",
        expectedRevisionNumber: 2,
        idempotencyKey: "publish-invalid-persisted",
        content,
      } as never),
    ).rejects.toBeInstanceOf(MarketingValidationError);

    expect(tx.coachLanding.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    expect(tx.productEvent.create).not.toHaveBeenCalled();
  });

  it("denies students at the repository boundary too", async () => {
    const { tx, database } = createDatabase();
    const repository = new PrismaMarketingRepository(database as never);

    await expect(repository.saveDraft(student, { content, idempotencyKey: "save-1" })).rejects.toBeInstanceOf(
      MarketingAccessDeniedError,
    );
    expect(tx.coachLandingRevision.create).not.toHaveBeenCalled();
  });

  it("allows super-admin mutations only through explicit workspace context", async () => {
    const { tx, database } = createDatabase();
    const repository = new PrismaMarketingRepository(database as never);

    await expect(repository.saveDraft(admin, { content, idempotencyKey: "save-1" })).resolves.toMatchObject({
      revisionNumber: 1,
    });
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: "admin-a", platformRole: "SUPER_ADMIN" },
      select: { id: true },
    });
  });
});
