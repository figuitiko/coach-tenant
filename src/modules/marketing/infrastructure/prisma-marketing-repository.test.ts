import { describe, expect, it, vi } from "vitest";
import {
  MarketingAccessDeniedError,
  MarketingConflictError,
  MarketingNotFoundError,
  MarketingValidationError,
} from "../domain/errors";
import { PrismaMarketingRepository } from "./prisma-marketing-repository";
import { fingerprintResultVersion, type LandingContentInput, type ResultVersionInput } from "../domain/contracts";
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

type MockResultVersionRow = {
  id: string;
  workspaceId: string;
  storyId: string;
  versionNumber: number;
  headline: string;
  narrative?: string | null;
  testimonial?: string | null;
  attributionMode: ResultVersionInput["attributionMode"];
  attributionLabel: string;
  metrics: ResultVersionInput["metrics"];
  supersededAt: Date | null;
  approval: { id: string; revokedAt: Date | null; approvedFingerprint: string } | null;
  story: { id: string; currentVersionId: string | null; studentMembership: { id: string; userId: string } };
};

function createTransaction() {
  const state = {
    landing: null as null | {
      id: string;
      workspaceId: string;
      currentDraftRevisionId: string | null;
      publishedRevisionId: string | null;
      currentDraftRevision?: ({ id?: string; revisionNumber: number } & Partial<LandingContentInput>) | null;
      publishedRevision?: ({ id?: string; revisionNumber: number } & Partial<LandingContentInput>) | null;
    },
    revisionCount: 0,
    resultStory: null as null | {
      id: string;
      workspaceId: string;
      studentMembershipId: string;
      currentVersionId: string | null;
      currentVersion?: { id: string; versionNumber: number } | null;
    },
    resultVersion: null as null | MockResultVersionRow,
    resultVersionCount: 0,
  };
  return {
    state,
    membership: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === "workspace-a" && where.userId === "coach-a" && where.role === "COACH"
          ? { id: "membership-a" }
          : where.id === "membership-student-a" && where.workspaceId === "workspace-a" && where.role === "STUDENT"
            ? { id: "membership-student-a", userId: "student-a" }
            : where.workspaceId === "workspace-a" && where.userId === "student-a" && where.role === "STUDENT"
              ? { id: "membership-student-a" }
              : null,
      ),
    },
    user: {
      findFirst: vi.fn(async ({ where }) =>
        where.id === "admin-a" && where.platformRole === "SUPER_ADMIN" ? { id: "admin-a" } : null,
      ),
    },
    workspace: {
      findUnique: vi.fn(async ({ where }) =>
        where.slug === "fuerza-norte" && state.landing?.publishedRevisionId
          ? {
              id: "workspace-a",
              slug: "fuerza-norte",
              name: "Fuerza Norte",
              coachLanding: state.landing,
            }
          : null,
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
    landingProgram: { create: vi.fn(async ({ data }) => ({ id: `program-${data.order}`, ...data })) },
    landingMethodStep: { create: vi.fn(async ({ data }) => ({ id: `step-${data.order}`, ...data })) },
    landingFaq: { create: vi.fn(async ({ data }) => ({ id: `faq-${data.order}`, ...data })) },
    landingRevisionResult: { create: vi.fn(async ({ data }) => ({ id: `selection-${data.order}`, ...data })) },
    studentResultStory: {
      create: vi.fn(async ({ data }) => {
        state.resultStory = {
          id: "story-a",
          workspaceId: data.workspaceId,
          studentMembershipId: data.studentMembershipId,
          currentVersionId: null,
          currentVersion: null,
        };
        return state.resultStory;
      }),
      findFirst: vi.fn(async ({ where }) =>
        state.resultStory &&
        where.id === state.resultStory.id &&
        where.workspaceId === state.resultStory.workspaceId &&
        where.studentMembershipId === state.resultStory.studentMembershipId
          ? state.resultStory
          : null,
      ),
      update: vi.fn(async ({ data }) => {
        if (!state.resultStory) throw new Error("missing result story");
        state.resultStory = { ...state.resultStory, ...data };
        return state.resultStory;
      }),
    },
    studentResultVersion: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => {
        state.resultVersionCount += 1;
        const created = {
          id: `result-version-${data.versionNumber}`,
          ...data,
          metrics: [],
          supersededAt: null,
          approval: null,
          story: {
            id: data.storyId,
            currentVersionId: null,
            studentMembership: { id: "membership-student-a", userId: "student-a" },
          },
        };
        state.resultVersion = created;
        return created;
      }),
      update: vi.fn(async ({ where, data }) => {
        if (state.resultVersion?.id === where.id_workspaceId?.id)
          state.resultVersion = { ...state.resultVersion, ...data };
        return state.resultVersion ?? { id: where.id_workspaceId?.id, ...data };
      }),
      findFirst: vi.fn(async ({ where }) => (state.resultVersion?.id === where.id ? state.resultVersion : null)),
      findMany: vi.fn(async ({ where } = {}) => {
        const ids = where?.id?.in as string[] | undefined;
        if (!state.resultVersion) return [];
        if (ids && !ids.includes(state.resultVersion.id)) return [];
        return [state.resultVersion];
      }),
    },
    studentResultMetricSnapshot: {
      create: vi.fn(async ({ data }) => ({ id: `metric-${data.order}`, ...data })),
    },
    studentResultApproval: {
      create: vi.fn(async ({ data }) => {
        const approval = { id: "approval-a", revokedAt: null, ...data };
        if (state.resultVersion) state.resultVersion.approval = approval;
        return approval;
      }),
      update: vi.fn(async ({ data }) => {
        if (state.resultVersion?.approval) state.resultVersion.approval = { ...state.resultVersion.approval, ...data };
        return state.resultVersion?.approval;
      }),
    },
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

describe("PrismaMarketingRepository result consent mutations", () => {
  const resultContent = {
    headline: "Transformación sostenible",
    narrative: "Entrena con constancia y mejor técnica.",
    testimonial: "Me siento con más energía.",
    attributionMode: "ANONYMOUS" as const,
    attributionLabel: "Anónimo",
    metrics: [{ label: "Peso", beforeValue: 90, afterValue: 84, unit: "KG" as const, order: 0 }],
  };

  it("creates the first immutable result version for a same-workspace student and writes events", async () => {
    const { tx, database } = createDatabase();
    const repository = new PrismaMarketingRepository(database as never, () => "payload-hash-a");
    const fingerprint = fingerprintResultVersion(resultContent);

    await expect(
      repository.requestResultApproval(coach, {
        studentMembershipId: "membership-student-a",
        content: resultContent,
        idempotencyKey: "result-1",
      }),
    ).resolves.toMatchObject({
      storyId: "story-a",
      versionId: "result-version-1",
      versionNumber: 1,
      fingerprint,
      state: "PENDING",
    });

    expect(tx.membership.findFirst).toHaveBeenCalledWith({
      where: { id: "membership-student-a", workspaceId: "workspace-a", role: "STUDENT" },
      select: { id: true, userId: true },
    });
    expect(tx.studentResultStory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "workspace-a", studentMembershipId: "membership-student-a" }),
      }),
    );
    expect(tx.studentResultVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 1,
          mutationKey: expect.stringContaining("requestResultApproval:result-1"),
        }),
      }),
    );
    expect(tx.studentResultStory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentVersionId: "result-version-1" } }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "marketing.result.version_requested" }) }),
    );
  });

  it("rejects replacing an existing result when the expected current version is omitted", async () => {
    const tx = createTransaction();
    tx.state.resultStory = {
      id: "story-a",
      workspaceId: "workspace-a",
      studentMembershipId: "membership-student-a",
      currentVersionId: "result-version-1",
      currentVersion: { id: "result-version-1", versionNumber: 1 },
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.requestResultApproval(coach, {
        storyId: "story-a",
        studentMembershipId: "membership-student-a",
        content: { ...resultContent, headline: "Stale replacement" },
        idempotencyKey: "result-stale-floating",
      }),
    ).rejects.toBeInstanceOf(MarketingConflictError);

    expect(tx.studentResultVersion.update).not.toHaveBeenCalled();
    expect(tx.studentResultVersion.create).not.toHaveBeenCalled();
    expect(tx.studentResultStory.update).not.toHaveBeenCalled();
  });

  it("replaces the current version by superseding v1 and making v2 pending without publishing a landing", async () => {
    const tx = createTransaction();
    tx.state.resultStory = {
      id: "story-a",
      workspaceId: "workspace-a",
      studentMembershipId: "membership-student-a",
      currentVersionId: "result-version-1",
      currentVersion: { id: "result-version-1", versionNumber: 1 },
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never, () => "fingerprint-v2");

    await expect(
      repository.requestResultApproval(coach, {
        storyId: "story-a",
        studentMembershipId: "membership-student-a",
        expectedCurrentVersionId: "result-version-1",
        content: { ...resultContent, headline: "Transformación v2" },
        idempotencyKey: "result-2",
      }),
    ).resolves.toMatchObject({ versionId: "result-version-2", versionNumber: 2, state: "PENDING" });

    expect(tx.studentResultVersion.update).toHaveBeenCalledWith({
      where: { id_workspaceId: { id: "result-version-1", workspaceId: "workspace-a" } },
      data: { supersededAt: expect.any(Date) },
    });
    expect(tx.studentResultStory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentVersionId: "result-version-2" } }),
    );
    expect(tx.coachLanding.update).not.toHaveBeenCalled();
  });

  it("allows only the owning student to approve the exact current fingerprint", async () => {
    const tx = createTransaction();
    tx.state.resultVersion = {
      id: "result-version-1",
      workspaceId: "workspace-a",
      storyId: "story-a",
      versionNumber: 1,
      ...resultContent,
      story: {
        id: "story-a",
        currentVersionId: "result-version-1",
        studentMembership: { id: "membership-student-a", userId: "student-a" },
      },
      metrics: resultContent.metrics,
      supersededAt: null,
      approval: null,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never, () => "payload-hash-a");
    const fingerprint = fingerprintResultVersion(resultContent);

    await expect(
      repository.approveResultVersion(student, {
        resultVersionId: "result-version-1",
        fingerprint,
        idempotencyKey: "approve-1",
      }),
    ).resolves.toMatchObject({ versionId: "result-version-1", state: "APPROVED", fingerprint });

    expect(tx.studentResultVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "result-version-1", workspaceId: "workspace-a", story: { workspaceId: "workspace-a" } },
      }),
    );
    expect(tx.studentResultApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentId: "student-a", approvedFingerprint: fingerprint }),
      }),
    );
  });

  it("rejects stale approvals for a superseded or non-current version", async () => {
    const tx = createTransaction();
    tx.state.resultVersion = {
      id: "result-version-1",
      workspaceId: "workspace-a",
      storyId: "story-a",
      versionNumber: 1,
      ...resultContent,
      story: {
        id: "story-a",
        currentVersionId: "result-version-2",
        studentMembership: { id: "membership-student-a", userId: "student-a" },
      },
      metrics: resultContent.metrics,
      supersededAt: new Date(),
      approval: null,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never, () => "fingerprint-a");

    await expect(
      repository.approveResultVersion(student, {
        resultVersionId: "result-version-1",
        fingerprint: "fingerprint-a",
        idempotencyKey: "approve-stale",
      }),
    ).rejects.toBeInstanceOf(MarketingConflictError);
    expect(tx.studentResultApproval.create).not.toHaveBeenCalled();
  });

  it("revokes own approved version terminally and replaying the same revocation is single-effect", async () => {
    const tx = createTransaction();
    tx.state.resultVersion = {
      id: "result-version-1",
      workspaceId: "workspace-a",
      storyId: "story-a",
      versionNumber: 1,
      ...resultContent,
      story: {
        id: "story-a",
        currentVersionId: "result-version-1",
        studentMembership: { id: "membership-student-a", userId: "student-a" },
      },
      metrics: resultContent.metrics,
      supersededAt: null,
      approval: { id: "approval-a", revokedAt: null, approvedFingerprint: "fingerprint-a" },
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never, () => "fingerprint-a");

    await expect(
      repository.revokeResultVersion(student, { resultVersionId: "result-version-1", idempotencyKey: "revoke-1" }),
    ).resolves.toMatchObject({ versionId: "result-version-1", state: "REVOKED" });
    await expect(
      repository.revokeResultVersion(student, { resultVersionId: "result-version-1", idempotencyKey: "revoke-2" }),
    ).resolves.toMatchObject({ versionId: "result-version-1", state: "REVOKED" });

    expect(tx.studentResultApproval.update).toHaveBeenCalledTimes(1);
  });
});

describe("PrismaMarketingRepository Batch 5 publication safety", () => {
  const approvedResultContent = {
    headline: "Transformación sostenible",
    narrative: "Entrena con constancia y mejor técnica.",
    testimonial: "Me siento con más energía.",
    attributionMode: "ANONYMOUS" as const,
    attributionLabel: "Anónimo",
    metrics: [{ label: "Peso", beforeValue: 90, afterValue: 84, unit: "KG" as const, order: 0 }],
  };

  it("blocks publishing a draft with pending selected results without changing the live pointer or events", async () => {
    const tx = createTransaction();
    tx.state.resultVersion = {
      id: "result-version-pending",
      workspaceId: "workspace-a",
      storyId: "story-a",
      versionNumber: 1,
      ...approvedResultContent,
      metrics: approvedResultContent.metrics,
      supersededAt: null,
      approval: null,
      story: {
        id: "story-a",
        currentVersionId: "result-version-pending",
        studentMembership: { id: "membership-student-a", userId: "student-a" },
      },
    };
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-2",
      publishedRevisionId: "revision-1",
      currentDraftRevision: {
        ...content,
        id: "revision-2",
        revisionNumber: 2,
        resultSelections: [{ resultVersionId: "result-version-pending", order: 0 }],
      } as never,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.publishLanding(coach, {
        revisionId: "revision-2",
        expectedRevisionNumber: 2,
        idempotencyKey: "publish-pending",
      }),
    ).rejects.toMatchObject({
      code: "PUBLICATION_BLOCKED",
      blockers: [{ resultVersionId: "result-version-pending", reason: "PENDING_APPROVAL" }],
    });

    expect(tx.coachLanding.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    expect(tx.productEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "revoked",
      {
        approval: { id: "approval-a", revokedAt: new Date("2026-09-06T00:00:00.000Z"), approvedFingerprint: "MATCH" },
        supersededAt: null,
        currentVersionId: "result-version-1",
        reason: "REVOKED",
      },
    ],
    [
      "superseded",
      {
        approval: { id: "approval-a", revokedAt: null, approvedFingerprint: "MATCH" },
        supersededAt: new Date("2026-09-06T00:00:00.000Z"),
        currentVersionId: "result-version-2",
        reason: "SUPERSEDED",
      },
    ],
    [
      "fingerprint-mismatched",
      {
        approval: { id: "approval-a", revokedAt: null, approvedFingerprint: "stale-fingerprint" },
        supersededAt: null,
        currentVersionId: "result-version-1",
        reason: "SUPERSEDED",
      },
    ],
  ] as const)("blocks publishing a draft with a %s selected result", async (_caseName, state) => {
    const tx = createTransaction();
    const approvedFingerprint =
      state.approval.approvedFingerprint === "MATCH"
        ? fingerprintResultVersion(approvedResultContent)
        : state.approval.approvedFingerprint;
    tx.state.resultVersion = {
      id: "result-version-1",
      workspaceId: "workspace-a",
      storyId: "story-a",
      versionNumber: 1,
      ...approvedResultContent,
      metrics: approvedResultContent.metrics,
      supersededAt: state.supersededAt,
      approval: { ...state.approval, approvedFingerprint },
      story: {
        id: "story-a",
        currentVersionId: state.currentVersionId,
        studentMembership: { id: "membership-student-a", userId: "student-a" },
      },
    };
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-2",
      publishedRevisionId: "revision-1",
      currentDraftRevision: {
        ...content,
        id: "revision-2",
        revisionNumber: 2,
        resultSelections: [{ resultVersionId: "result-version-1", order: 0 }],
      } as never,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.publishLanding(coach, {
        revisionId: "revision-2",
        expectedRevisionNumber: 2,
        idempotencyKey: `publish-${_caseName}`,
      }),
    ).rejects.toMatchObject({
      code: "PUBLICATION_BLOCKED",
      blockers: [{ resultVersionId: "result-version-1", reason: state.reason }],
    });

    expect(tx.coachLanding.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("fails closed when a draft selects a non-ready or foreign marketing asset", async () => {
    const tx = createTransaction();
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-2",
      publishedRevisionId: "revision-1",
      currentDraftRevision: {
        ...content,
        id: "revision-2",
        revisionNumber: 2,
        logoAssetId: "asset-not-ready",
      } as never,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.publishLanding(coach, {
        revisionId: "revision-2",
        expectedRevisionNumber: 2,
        idempotencyKey: "publish-asset",
      }),
    ).rejects.toBeInstanceOf(MarketingNotFoundError);

    expect(tx.marketingAsset.count).toHaveBeenCalledWith({
      where: { id: { in: ["asset-not-ready"] }, workspaceId: "workspace-a", uploadIntent: { status: "CONSUMED" } },
    });
    expect(tx.coachLanding.update).not.toHaveBeenCalled();
  });

  it("fails closed for foreign selected result IDs before constructing blockers", async () => {
    const tx = createTransaction();
    tx.studentResultVersion.count.mockResolvedValueOnce(0);
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-2",
      publishedRevisionId: "revision-1",
      currentDraftRevision: {
        ...content,
        id: "revision-2",
        revisionNumber: 2,
        resultSelections: [{ resultVersionId: "foreign-result-version", order: 0 }],
      } as never,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    await expect(
      repository.publishLanding(coach, {
        revisionId: "revision-2",
        expectedRevisionNumber: 2,
        idempotencyKey: "publish-foreign",
      }),
    ).rejects.toBeInstanceOf(MarketingNotFoundError);

    expect(tx.coachLanding.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("returns a public allowlist from the published revision and omits revoked or superseded selected result cards", async () => {
    const tx = createTransaction();
    tx.state.resultVersion = {
      id: "result-version-1",
      workspaceId: "workspace-a",
      storyId: "story-a",
      versionNumber: 1,
      ...approvedResultContent,
      metrics: approvedResultContent.metrics,
      supersededAt: null,
      approval: {
        id: "approval-a",
        revokedAt: null,
        approvedFingerprint: fingerprintResultVersion(approvedResultContent),
      },
      story: {
        id: "story-a",
        currentVersionId: "result-version-1",
        studentMembership: { id: "membership-student-a", userId: "student-a" },
      },
    };
    tx.state.landing = {
      id: "landing-a",
      workspaceId: "workspace-a",
      currentDraftRevisionId: "revision-2",
      publishedRevisionId: "revision-1",
      currentDraftRevision: { ...content, id: "revision-2", revisionNumber: 2, heroHeadline: "Draft copy" },
      publishedRevision: {
        ...content,
        id: "revision-1",
        revisionNumber: 1,
        heroHeadline: "Live copy",
        resultSelections: [{ resultVersionId: "result-version-1", order: 0 }],
        programs: content.services?.map((item, order) => ({ ...item, order })),
        methodSteps: [],
        faqs: [],
      } as never,
    };
    const { database } = createDatabase(tx);
    const repository = new PrismaMarketingRepository(database as never);

    const dto = await (
      repository as unknown as { getPublishedLanding(slug: string): Promise<unknown> }
    ).getPublishedLanding("fuerza-norte");

    expect(dto).toMatchObject({
      workspaceSlug: "fuerza-norte",
      revisionId: "revision-1",
      themeKey: "editorial",
      hero: { headline: "Live copy" },
      results: [{ publicId: "result-1", headline: "Transformación sostenible" }],
      cta: { href: "/c/fuerza-norte/go/whatsapp" },
    });
    expect(JSON.stringify(dto)).not.toContain("workspaceId");
    expect(JSON.stringify(dto)).not.toContain("membership-student-a");
    expect(JSON.stringify(dto)).not.toContain("result-version-1");
    expect(JSON.stringify(dto)).not.toContain("541112345678");

    tx.state.resultVersion.attributionMode = "FIRST_NAME_INITIAL";
    tx.state.resultVersion.attributionLabel = "Mati";
    tx.state.resultVersion.approval = {
      ...tx.state.resultVersion.approval!,
      approvedFingerprint: fingerprintResultVersion({
        ...approvedResultContent,
        attributionMode: "FIRST_NAME_INITIAL",
        attributionLabel: "Mati",
      }),
    };

    await expect(
      (
        repository as unknown as {
          getPublishedLanding(slug: string): Promise<{ results: Array<{ attributionLabel: string }> }>;
        }
      ).getPublishedLanding("fuerza-norte"),
    ).resolves.toMatchObject({ results: [{ attributionLabel: "Mati" }] });

    tx.state.resultVersion.approval = { ...tx.state.resultVersion.approval!, revokedAt: new Date() };
    await expect(
      (
        repository as unknown as { getPublishedLanding(slug: string): Promise<{ results: unknown[] }> }
      ).getPublishedLanding("fuerza-norte"),
    ).resolves.toMatchObject({ results: [] });

    tx.state.resultVersion.approval = {
      id: "approval-a",
      revokedAt: null,
      approvedFingerprint: fingerprintResultVersion(approvedResultContent),
    };
    tx.state.resultVersion.supersededAt = new Date();
    tx.state.resultVersion.story.currentVersionId = "result-version-2";
    await expect(
      (
        repository as unknown as { getPublishedLanding(slug: string): Promise<{ results: unknown[] }> }
      ).getPublishedLanding("fuerza-norte"),
    ).resolves.toMatchObject({ results: [] });
  });
});
