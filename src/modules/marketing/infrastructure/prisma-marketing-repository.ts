import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  LandingEditorDto,
  LandingMutationResult,
  LandingPreviewDto,
  MarketingActor,
  MarketingLandingRepository,
  PreviewRevisionCommand,
  PublishLandingCommand,
  UnpublishLandingCommand,
  UnpublishLandingResult,
  LandingRevisionCommand,
  RequestResultApprovalCommand,
  ResultApprovalDecisionResult,
  ResultApprovalRequestResult,
  StudentResultApprovalDto,
  ApproveResultVersionCommand,
  RevokeResultVersionCommand,
} from "../application/marketing-service";
import {
  fingerprintResultVersion,
  validatePublication,
  type LandingContentInput,
  type MetricInput,
  type ResultVersionInput,
} from "../domain/contracts";
import {
  MarketingAccessDeniedError,
  MarketingConflictError,
  MarketingNotFoundError,
  MarketingPublicationBlockedError,
  type PublicationBlocker,
} from "../domain/errors";
import { toPublicCoachLandingDto, type PublicCoachLandingDto } from "../domain/dto";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type HashFunction = (value: unknown) => string;

type IdempotentOutput =
  LandingMutationResult | UnpublishLandingResult | ResultApprovalRequestResult | ResultApprovalDecisionResult;

export class PrismaMarketingRepository implements MarketingLandingRepository {
  constructor(
    private readonly database: Pick<PrismaClient, "$transaction">,
    private readonly hash: HashFunction = stableHash,
  ) {}

  async getEditor(actor: MarketingActor): Promise<LandingEditorDto> {
    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const landing = await tx.coachLanding.findUnique({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, currentDraftRevisionId: true, publishedRevisionId: true },
      });
      return {
        landingId: landing?.id ?? null,
        currentDraftRevisionId: landing?.currentDraftRevisionId ?? null,
        publishedRevisionId: landing?.publishedRevisionId ?? null,
      };
    });
  }

  async saveDraft(actor: MarketingActor, command: LandingRevisionCommand): Promise<LandingMutationResult> {
    const payloadHash = this.hash({
      action: "saveDraft",
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      expectedRevisionNumber: command.expectedRevisionNumber ?? null,
      logoAssetId: command.logoAssetId ?? null,
      portraitAssetId: command.portraitAssetId ?? null,
      selectedResultVersionIds: command.selectedResultVersionIds ?? [],
    });
    const dedupeKey = mutationKey(actor, "saveDraft", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const replay = await resolveReplay<LandingMutationResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;

      await assertAssetsBelongToWorkspace(tx, actor.workspaceId, [command.logoAssetId, command.portraitAssetId]);
      await assertResultVersionsBelongToWorkspace(tx, actor.workspaceId, command.selectedResultVersionIds ?? []);

      const landing = await tx.coachLanding.upsert({
        where: { workspaceId: actor.workspaceId },
        create: { workspaceId: actor.workspaceId },
        update: {},
        include: { currentDraftRevision: { select: { revisionNumber: true } } },
      });
      const currentRevisionNumber = landing.currentDraftRevision?.revisionNumber ?? 0;
      if (command.expectedRevisionNumber != null && command.expectedRevisionNumber !== currentRevisionNumber) {
        throw new MarketingConflictError("Stale landing revision");
      }

      const revisionNumber = currentRevisionNumber + 1;
      const revision = await tx.coachLandingRevision.create({
        data: revisionCreateData(actor, landing.id, revisionNumber, dedupeKey, payloadHash, command),
      });
      await createOrderedChildren(tx, actor.workspaceId, revision.id, command.content);
      await createResultSelections(tx, actor.workspaceId, revision.id, command.selectedResultVersionIds ?? []);
      await tx.coachLanding.update({ where: { id: landing.id }, data: { currentDraftRevisionId: revision.id } });

      const output: LandingMutationResult = {
        landingId: landing.id,
        revisionId: revision.id,
        revisionNumber,
        publishedRevisionId: landing.publishedRevisionId ?? null,
      };
      await createEventPair(tx, actor, {
        dedupeKey,
        action: "marketing.landing.draft_saved",
        name: "marketing_landing_draft_saved",
        entityType: "CoachLandingRevision",
        entityId: revision.id,
        payloadHash,
        output,
      });
      return output;
    });
  }

  async previewRevision(actor: MarketingActor, command: PreviewRevisionCommand): Promise<LandingPreviewDto> {
    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const revision = await tx.coachLandingRevision.findFirst({
        where: { id: command.revisionId, workspaceId: actor.workspaceId, landing: { workspaceId: actor.workspaceId } },
        include: {
          landing: { select: { id: true, publishedRevisionId: true } },
          programs: { orderBy: { order: "asc" } },
          methodSteps: { orderBy: { order: "asc" } },
          faqs: { orderBy: { order: "asc" } },
        },
      });
      if (!revision) throw new MarketingNotFoundError();
      return {
        landingId: revision.landing.id,
        revisionId: revision.id,
        revisionNumber: revision.revisionNumber,
        publishedRevisionId: revision.landing.publishedRevisionId,
        liveRevisionId: revision.landing.publishedRevisionId,
        content: revisionToContent(revision),
      };
    });
  }

  async publishLanding(actor: MarketingActor, command: PublishLandingCommand): Promise<LandingMutationResult> {
    const payloadHash = this.hash({
      action: "publishLanding",
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      revisionId: command.revisionId,
      expectedRevisionNumber: command.expectedRevisionNumber,
    });
    const dedupeKey = mutationKey(actor, "publishLanding", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const replay = await resolveReplay<LandingMutationResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;
      const landing = await tx.coachLanding.findUnique({
        where: { workspaceId: actor.workspaceId },
        include: {
          currentDraftRevision: {
            include: {
              programs: { orderBy: { order: "asc" } },
              methodSteps: { orderBy: { order: "asc" } },
              faqs: { orderBy: { order: "asc" } },
              resultSelections: { orderBy: { order: "asc" } },
            },
          },
        },
      });
      if (!landing || landing.currentDraftRevision?.id !== command.revisionId) throw new MarketingNotFoundError();
      if (landing.currentDraftRevision.revisionNumber !== command.expectedRevisionNumber)
        throw new MarketingConflictError("Stale landing revision");
      validatePublication(revisionToContent(landing.currentDraftRevision));
      await assertAssetsReadyForPublication(tx, actor.workspaceId, [
        landing.currentDraftRevision.logoAssetId,
        landing.currentDraftRevision.portraitAssetId,
      ]);
      const selectedResultVersionIds = selectedResultIds(landing.currentDraftRevision);
      await assertSelectedResultsBelongToWorkspace(tx, actor.workspaceId, selectedResultVersionIds);
      const blockers = await findPublicationBlockers(tx, actor.workspaceId, selectedResultVersionIds);
      if (blockers.length) throw new MarketingPublicationBlockedError(blockers);
      const publishedAt = new Date();
      await tx.coachLanding.update({
        where: { id: landing.id },
        data: { publishedRevisionId: command.revisionId, publishedAt },
      });
      const output: LandingMutationResult = {
        landingId: landing.id,
        revisionId: command.revisionId,
        revisionNumber: command.expectedRevisionNumber,
        publishedRevisionId: command.revisionId,
        publishedAt,
      };
      await createEventPair(tx, actor, {
        dedupeKey,
        action: "marketing.landing.published",
        name: "marketing_landing_published",
        entityType: "CoachLandingRevision",
        entityId: command.revisionId,
        payloadHash,
        output,
      });
      return output;
    });
  }

  async unpublishLanding(actor: MarketingActor, command: UnpublishLandingCommand): Promise<UnpublishLandingResult> {
    const payloadHash = this.hash({
      action: "unpublishLanding",
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      expectedPublishedRevisionId: command.expectedPublishedRevisionId ?? null,
    });
    const dedupeKey = mutationKey(actor, "unpublishLanding", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const replay = await resolveReplay<UnpublishLandingResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;
      const landing = await tx.coachLanding.findUnique({ where: { workspaceId: actor.workspaceId } });
      if (!landing) throw new MarketingNotFoundError();
      if (command.expectedPublishedRevisionId && landing.publishedRevisionId !== command.expectedPublishedRevisionId) {
        throw new MarketingConflictError("Stale published landing revision");
      }
      await tx.coachLanding.update({
        where: { id: landing.id },
        data: { publishedRevisionId: null, publishedAt: null },
      });
      const output: UnpublishLandingResult = { landingId: landing.id, unpublished: true, publishedRevisionId: null };
      await createEventPair(tx, actor, {
        dedupeKey,
        action: "marketing.landing.unpublished",
        name: "marketing_landing_unpublished",
        entityType: "CoachLanding",
        entityId: landing.id,
        payloadHash,
        output,
      });
      return output;
    });
  }

  async requestResultApproval(
    actor: MarketingActor,
    command: RequestResultApprovalCommand,
  ): Promise<ResultApprovalRequestResult> {
    const fingerprint = fingerprintResultVersion(command.content);
    const payloadHash = this.hash({
      action: "requestResultApproval",
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      storyId: command.storyId ?? null,
      studentMembershipId: command.studentMembershipId,
      expectedCurrentVersionId: command.expectedCurrentVersionId ?? null,
      content: command.content,
      fingerprint,
    });
    const dedupeKey = mutationKey(actor, "requestResultApproval", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const replay = await resolveReplay<ResultApprovalRequestResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;

      await assertStudentMembership(tx, actor.workspaceId, command.studentMembershipId);
      const story = command.storyId
        ? await tx.studentResultStory.findFirst({
            where: {
              id: command.storyId,
              workspaceId: actor.workspaceId,
              studentMembershipId: command.studentMembershipId,
            },
            include: { currentVersion: { select: { id: true, versionNumber: true } } },
          })
        : await tx.studentResultStory.create({
            data: {
              workspaceId: actor.workspaceId,
              studentMembershipId: command.studentMembershipId,
              createdById: actor.actorId,
            },
            include: { currentVersion: { select: { id: true, versionNumber: true } } },
          });
      if (!story) throw new MarketingNotFoundError();

      const currentVersion = story.currentVersion as { id: string; versionNumber: number } | null | undefined;
      if (currentVersion && command.expectedCurrentVersionId !== currentVersion.id) {
        throw new MarketingConflictError("Stale result version");
      }
      if (!currentVersion && command.expectedCurrentVersionId) {
        throw new MarketingConflictError("Stale result version");
      }

      const versionNumber = (currentVersion?.versionNumber ?? 0) + 1;
      if (currentVersion) {
        await tx.studentResultVersion.update({
          where: { id_workspaceId: { id: currentVersion.id, workspaceId: actor.workspaceId } },
          data: { supersededAt: new Date() },
        });
      }
      const version = await tx.studentResultVersion.create({
        data: resultVersionCreateData(actor, story.id, versionNumber, dedupeKey, payloadHash, command.content),
      });
      await createResultMetrics(tx, actor.workspaceId, version.id, command.content.metrics);
      await tx.studentResultStory.update({ where: { id: story.id }, data: { currentVersionId: version.id } });

      const output: ResultApprovalRequestResult = {
        storyId: story.id,
        versionId: version.id,
        versionNumber,
        fingerprint,
        state: "PENDING",
      };
      await createEventPair(tx, actor, {
        dedupeKey,
        action: "marketing.result.version_requested",
        name: "marketing_result_version_requested",
        entityType: "StudentResultVersion",
        entityId: version.id,
        payloadHash,
        output,
      });
      return output;
    });
  }

  async listApprovalRequests(actor: MarketingActor): Promise<StudentResultApprovalDto[]> {
    return this.transaction(async (tx) => {
      await assertStudentActor(tx, actor);
      const versions = await tx.studentResultVersion.findMany({
        where: {
          workspaceId: actor.workspaceId,
          story: { workspaceId: actor.workspaceId, studentMembership: { userId: actor.actorId, role: "STUDENT" } },
        },
        include: {
          story: { select: { id: true, currentVersionId: true } },
          metrics: { orderBy: { order: "asc" } },
          approval: true,
        },
        orderBy: { requestedAt: "desc" },
      });
      return versions.map((version: Record<string, unknown>) => ({
        storyId: String((version.story as Record<string, unknown>).id),
        versionId: String(version.id),
        versionNumber: Number(version.versionNumber),
        fingerprint: fingerprintResultVersion(versionToResultInput(version)),
        content: versionToResultInput(version),
        state: resultState(version),
      }));
    });
  }

  async approveResultVersion(
    actor: MarketingActor,
    command: ApproveResultVersionCommand,
  ): Promise<ResultApprovalDecisionResult> {
    const payloadHash = this.hash({
      action: "approveResultVersion",
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      resultVersionId: command.resultVersionId,
      fingerprint: command.fingerprint,
    });
    const dedupeKey = mutationKey(actor, "approveResultVersion", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertStudentActor(tx, actor);
      const replay = await resolveReplay<ResultApprovalDecisionResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;
      const version = await findOwnedResultVersion(tx, actor, command.resultVersionId);
      const currentVersionId = String((version.story as Record<string, unknown>).currentVersionId ?? "");
      if (version.supersededAt || currentVersionId !== version.id)
        throw new MarketingConflictError("Stale result version");
      const approval = version.approval as { revokedAt?: Date | null; approvedFingerprint?: string } | null | undefined;
      if (approval?.revokedAt) throw new MarketingConflictError("Result approval was revoked");
      const fingerprint = fingerprintResultVersion(versionToResultInput(version));
      if (fingerprint !== command.fingerprint) throw new MarketingConflictError("Result fingerprint mismatch");
      if (!approval) {
        await tx.studentResultApproval.create({
          data: {
            workspaceId: actor.workspaceId,
            resultVersionId: version.id,
            studentId: actor.actorId,
            approvedFingerprint: fingerprint,
            approveMutationKey: dedupeKey,
          },
        });
      }
      const output: ResultApprovalDecisionResult = {
        storyId: String(version.storyId),
        versionId: version.id,
        fingerprint,
        state: "APPROVED",
      };
      if (!approval) {
        await createEventPair(tx, actor, {
          dedupeKey,
          action: "marketing.result.approved",
          name: "marketing_result_approved",
          entityType: "StudentResultVersion",
          entityId: version.id,
          payloadHash,
          output,
        });
      }
      return output;
    });
  }

  async revokeResultVersion(
    actor: MarketingActor,
    command: RevokeResultVersionCommand,
  ): Promise<ResultApprovalDecisionResult> {
    const payloadHash = this.hash({
      action: "revokeResultVersion",
      actorId: actor.actorId,
      workspaceId: actor.workspaceId,
      resultVersionId: command.resultVersionId,
    });
    const dedupeKey = mutationKey(actor, "revokeResultVersion", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertStudentActor(tx, actor);
      const replay = await resolveReplay<ResultApprovalDecisionResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;
      const version = await findOwnedResultVersion(tx, actor, command.resultVersionId);
      const approval = version.approval as
        { id: string; revokedAt?: Date | null; approvedFingerprint?: string } | null | undefined;
      if (!approval) throw new MarketingConflictError("Result version is not approved");
      const output: ResultApprovalDecisionResult = {
        storyId: String(version.storyId),
        versionId: version.id,
        state: "REVOKED",
      };
      if (approval.revokedAt) return output;
      await tx.studentResultApproval.update({
        where: { id: approval.id },
        data: { revokedAt: new Date(), revokeMutationKey: dedupeKey },
      });
      await createEventPair(tx, actor, {
        dedupeKey,
        action: "marketing.result.revoked",
        name: "marketing_result_revoked",
        entityType: "StudentResultVersion",
        entityId: version.id,
        payloadHash,
        output,
      });
      return output;
    });
  }

  async getPublishedLanding(workspaceSlug: string): Promise<PublicCoachLandingDto | null> {
    return this.transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { slug: workspaceSlug },
        select: {
          id: true,
          slug: true,
          name: true,
          coachLanding: {
            select: {
              publishedRevisionId: true,
              publishedRevision: {
                include: {
                  credibilityFacts: { orderBy: { order: "asc" } },
                  programs: { orderBy: { order: "asc" } },
                  methodSteps: { orderBy: { order: "asc" } },
                  faqs: { orderBy: { order: "asc" } },
                  resultSelections: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      });
      const landing = workspace?.coachLanding as
        { publishedRevisionId: string | null; publishedRevision?: Record<string, unknown> | null } | null | undefined;
      const revision = landing?.publishedRevision;
      if (!workspace || !landing?.publishedRevisionId || !revision) return null;
      const selectedIds = selectedResultIds(revision);
      const eligibleResults = selectedIds.length ? await findEligiblePublicResults(tx, workspace.id, selectedIds) : [];
      return toPublicCoachLandingDto({
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        revisionId: publicRevisionId(revision),
        ...revisionToPublicSource(revision),
        results: eligibleResults,
      });
    });
  }

  private transaction<T>(operation: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.database.$transaction(operation, { isolationLevel: "Serializable" } as never) as Promise<T>;
  }
}

async function assertLandingAuthor(tx: TransactionClient, actor: MarketingActor) {
  if (actor.role === "COACH") {
    const membership = await tx.membership.findFirst({
      where: { workspaceId: actor.workspaceId, userId: actor.actorId, role: "COACH" },
      select: { id: true },
    });
    if (!membership) throw new MarketingAccessDeniedError();
    return;
  }
  if (actor.role === "SUPER_ADMIN" && actor.accessMode === "WORKSPACE") {
    const admin = await tx.user.findFirst({
      where: { id: actor.actorId, platformRole: "SUPER_ADMIN" },
      select: { id: true },
    });
    if (admin) return;
  }
  throw new MarketingAccessDeniedError();
}

function mutationKey(actor: MarketingActor, action: string, idempotencyKey: string) {
  return `marketing:${actor.workspaceId}:${actor.actorId}:${action}:${idempotencyKey}`;
}

async function resolveReplay<T extends IdempotentOutput>(
  tx: TransactionClient,
  workspaceId: string,
  dedupeKey: string,
  payloadHash: string,
): Promise<T | null> {
  const existing = await tx.auditEvent.findUnique({
    where: { workspaceId_dedupeKey: { workspaceId, dedupeKey } },
    select: { metadata: true },
  });
  if (!existing) return null;
  const metadata = existing.metadata as { payloadHash?: string; output?: T } | null;
  if (metadata?.payloadHash !== payloadHash || !metadata.output)
    throw new MarketingConflictError("Idempotency key was reused with different content");
  return metadata.output;
}

async function createEventPair(
  tx: TransactionClient,
  actor: MarketingActor,
  input: {
    dedupeKey: string;
    action: string;
    name: string;
    entityType: string;
    entityId: string;
    payloadHash: string;
    output: IdempotentOutput;
  },
) {
  const metadata = { payloadHash: input.payloadHash, output: input.output };
  await tx.auditEvent.create({
    data: {
      workspaceId: actor.workspaceId,
      actorId: actor.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      dedupeKey: input.dedupeKey,
      metadata,
    },
  });
  await tx.productEvent.create({
    data: {
      workspaceId: actor.workspaceId,
      userId: actor.actorId,
      name: input.name,
      dedupeKey: input.dedupeKey,
      properties: { entityId: input.entityId },
    },
  });
}

async function assertAssetsBelongToWorkspace(
  tx: TransactionClient,
  workspaceId: string,
  assetIds: Array<string | null | undefined>,
) {
  const ids = assetIds.filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  const count = await tx.marketingAsset.count({ where: { id: { in: ids }, workspaceId } });
  if (count !== new Set(ids).size) throw new MarketingNotFoundError();
}

async function assertResultVersionsBelongToWorkspace(
  tx: TransactionClient,
  workspaceId: string,
  resultVersionIds: string[],
) {
  if (!resultVersionIds.length) return;
  const count = await tx.studentResultVersion.count({ where: { id: { in: resultVersionIds }, workspaceId } });
  if (count !== new Set(resultVersionIds).size) throw new MarketingNotFoundError();
}

function revisionCreateData(
  actor: MarketingActor,
  landingId: string,
  revisionNumber: number,
  mutationKeyValue: string,
  payloadHash: string,
  command: LandingRevisionCommand,
) {
  const content = command.content;
  return {
    workspaceId: actor.workspaceId,
    landingId,
    revisionNumber,
    themeKey: content.themeKey ?? "editorial",
    createdById: actor.actorId,
    mutationKey: mutationKeyValue,
    payloadHash,
    coachDisplayName: content.coachDisplayName ?? "",
    heroEyebrow: content.heroEyebrow ?? null,
    heroHeadline: content.heroHeadline ?? "",
    heroSubheadline: content.heroSubheadline ?? "",
    valueProposition: content.valueProposition ?? null,
    servicesHeading: content.servicesHeading ?? null,
    methodologyHeading: content.methodologyHeading ?? null,
    resultsHeading: content.resultsHeading ?? null,
    aboutHeading: content.aboutHeading ?? null,
    aboutBody: content.aboutBody ?? null,
    faqHeading: content.faqHeading ?? null,
    ctaHeading: content.ctaHeading ?? "",
    ctaBody: content.ctaBody ?? null,
    whatsappDigits: content.whatsappDigits ?? "",
    whatsappMessage: content.whatsappMessage ?? "",
    instagramUrl: content.instagramUrl ?? null,
    publicEmail: content.publicEmail ?? null,
    seoTitle: content.seoTitle ?? null,
    seoDescription: content.seoDescription ?? null,
    logoAssetId: command.logoAssetId ?? null,
    portraitAssetId: command.portraitAssetId ?? null,
  };
}

async function createOrderedChildren(
  tx: TransactionClient,
  workspaceId: string,
  revisionId: string,
  content: LandingContentInput,
) {
  await Promise.all([
    ...(content.services ?? []).map((program, order) =>
      tx.landingProgram.create({ data: { revisionId, order, title: program.title, description: program.description } }),
    ),
    ...(content.methodology ?? []).map((step, order) =>
      tx.landingMethodStep.create({ data: { revisionId, order, title: step.title, description: step.description } }),
    ),
    ...(content.faqs ?? []).map((faq, order) =>
      tx.landingFaq.create({ data: { revisionId, order, question: faq.question, answer: faq.answer } }),
    ),
  ]);
  void workspaceId;
}

async function createResultSelections(
  tx: TransactionClient,
  workspaceId: string,
  revisionId: string,
  resultVersionIds: string[],
) {
  await Promise.all(
    resultVersionIds.map((resultVersionId, order) =>
      tx.landingRevisionResult.create({ data: { workspaceId, revisionId, resultVersionId, order } }),
    ),
  );
}

function revisionToContent(revision: Record<string, unknown>): LandingContentInput {
  return {
    themeKey: revision.themeKey as string,
    coachDisplayName: revision.coachDisplayName as string,
    heroEyebrow: (revision.heroEyebrow as string | null) ?? null,
    heroHeadline: revision.heroHeadline as string,
    heroSubheadline: revision.heroSubheadline as string,
    valueProposition: (revision.valueProposition as string | null) ?? null,
    servicesHeading: (revision.servicesHeading as string | null) ?? null,
    services: Array.isArray(revision.programs)
      ? revision.programs.map((item) => ({
          title: String((item as Record<string, unknown>).title),
          description: String((item as Record<string, unknown>).description),
        }))
      : [],
    methodologyHeading: (revision.methodologyHeading as string | null) ?? null,
    methodology: Array.isArray(revision.methodSteps)
      ? revision.methodSteps.map((item) => ({
          title: String((item as Record<string, unknown>).title),
          description: String((item as Record<string, unknown>).description),
        }))
      : [],
    resultsHeading: (revision.resultsHeading as string | null) ?? null,
    aboutHeading: (revision.aboutHeading as string | null) ?? null,
    aboutBody: (revision.aboutBody as string | null) ?? null,
    faqHeading: (revision.faqHeading as string | null) ?? null,
    faqs: Array.isArray(revision.faqs)
      ? revision.faqs.map((item) => ({
          question: String((item as Record<string, unknown>).question),
          answer: String((item as Record<string, unknown>).answer),
        }))
      : [],
    ctaHeading: revision.ctaHeading as string,
    ctaBody: (revision.ctaBody as string | null) ?? null,
    whatsappDigits: revision.whatsappDigits as string,
    whatsappMessage: revision.whatsappMessage as string,
    instagramUrl: (revision.instagramUrl as string | null) ?? null,
    publicEmail: (revision.publicEmail as string | null) ?? null,
    seoTitle: (revision.seoTitle as string | null) ?? null,
    seoDescription: (revision.seoDescription as string | null) ?? null,
  };
}

async function assertStudentMembership(tx: TransactionClient, workspaceId: string, membershipId: string) {
  const membership = await tx.membership.findFirst({
    where: { id: membershipId, workspaceId, role: "STUDENT" },
    select: { id: true, userId: true },
  });
  if (!membership) throw new MarketingNotFoundError();
  return membership;
}

async function assertStudentActor(tx: TransactionClient, actor: MarketingActor) {
  if (actor.role !== "STUDENT") throw new MarketingAccessDeniedError();
  const membership = await tx.membership.findFirst({
    where: { workspaceId: actor.workspaceId, userId: actor.actorId, role: "STUDENT" },
    select: { id: true },
  });
  if (!membership) throw new MarketingAccessDeniedError();
}

async function findOwnedResultVersion(tx: TransactionClient, actor: MarketingActor, resultVersionId: string) {
  const version = await tx.studentResultVersion.findFirst({
    where: { id: resultVersionId, workspaceId: actor.workspaceId, story: { workspaceId: actor.workspaceId } },
    include: {
      story: {
        select: { id: true, currentVersionId: true, studentMembership: { select: { id: true, userId: true } } },
      },
      metrics: { orderBy: { order: "asc" } },
      approval: true,
    },
  });
  if (!version) throw new MarketingNotFoundError();
  const story = version.story as { studentMembership?: { userId?: string } };
  if (story.studentMembership?.userId !== actor.actorId) throw new MarketingNotFoundError();
  return version as Record<string, unknown> & { id: string; storyId: string; supersededAt?: Date | null };
}

function resultVersionCreateData(
  actor: MarketingActor,
  storyId: string,
  versionNumber: number,
  mutationKeyValue: string,
  payloadHash: string,
  content: ResultVersionInput,
) {
  return {
    workspaceId: actor.workspaceId,
    storyId,
    versionNumber,
    createdById: actor.actorId,
    headline: content.headline,
    narrative: content.narrative ?? null,
    testimonial: content.testimonial ?? null,
    attributionMode: content.attributionMode ?? "ANONYMOUS",
    attributionLabel: content.attributionLabel ?? "Anónimo",
    mutationKey: mutationKeyValue,
    payloadHash,
  };
}

async function createResultMetrics(
  tx: TransactionClient,
  workspaceId: string,
  resultVersionId: string,
  metrics: MetricInput[],
) {
  await Promise.all(
    metrics.map((metric) =>
      tx.studentResultMetricSnapshot.create({
        data: {
          workspaceId,
          resultVersionId,
          label: metric.label,
          beforeValue: metric.beforeValue,
          afterValue: metric.afterValue,
          unit: metric.unit,
          order: metric.order,
        },
      }),
    ),
  );
}

function versionToResultInput(version: Record<string, unknown>): ResultVersionInput {
  return {
    headline: String(version.headline),
    narrative: (version.narrative as string | null) ?? null,
    testimonial: (version.testimonial as string | null) ?? null,
    attributionMode: version.attributionMode as ResultVersionInput["attributionMode"],
    attributionLabel: (version.attributionLabel as string | null) ?? null,
    metrics: Array.isArray(version.metrics)
      ? version.metrics.map((metric) => ({
          label: String((metric as Record<string, unknown>).label),
          beforeValue: Number((metric as Record<string, unknown>).beforeValue),
          afterValue: Number((metric as Record<string, unknown>).afterValue),
          unit: (metric as Record<string, unknown>).unit as MetricInput["unit"],
          order: Number((metric as Record<string, unknown>).order),
        }))
      : [],
  };
}

function resultState(version: Record<string, unknown>): StudentResultApprovalDto["state"] {
  if (version.supersededAt || (version.story as Record<string, unknown>).currentVersionId !== version.id)
    return "SUPERSEDED";
  const approval = version.approval as { revokedAt?: Date | null } | null | undefined;
  if (approval?.revokedAt) return "REVOKED";
  if (approval) return "APPROVED";
  return "PENDING";
}

function stableHash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function selectedResultIds(revision: Record<string, unknown>): string[] {
  if (!Array.isArray(revision.resultSelections)) return [];
  return revision.resultSelections.map((selection) => String((selection as Record<string, unknown>).resultVersionId));
}

async function assertAssetsReadyForPublication(
  tx: TransactionClient,
  workspaceId: string,
  assetIds: Array<string | null | undefined>,
) {
  const ids = assetIds.filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  const count = await tx.marketingAsset.count({
    where: { id: { in: ids }, workspaceId, uploadIntent: { status: "CONSUMED" } },
  });
  if (count !== new Set(ids).size) throw new MarketingNotFoundError();
}

async function assertSelectedResultsBelongToWorkspace(
  tx: TransactionClient,
  workspaceId: string,
  resultVersionIds: string[],
) {
  if (!resultVersionIds.length) return;
  const versions = await tx.studentResultVersion.findMany({
    where: { id: { in: resultVersionIds }, workspaceId, story: { workspaceId } },
    select: { id: true },
  });
  if (versions.length !== new Set(resultVersionIds).size) throw new MarketingNotFoundError();
}

async function findPublicationBlockers(
  tx: TransactionClient,
  workspaceId: string,
  resultVersionIds: string[],
): Promise<PublicationBlocker[]> {
  if (!resultVersionIds.length) return [];
  const versions = await tx.studentResultVersion.findMany({
    where: { id: { in: resultVersionIds }, workspaceId, story: { workspaceId } },
    include: { story: { select: { currentVersionId: true } }, metrics: { orderBy: { order: "asc" } }, approval: true },
  });
  return versions.flatMap((version: Record<string, unknown>): PublicationBlocker[] => {
    const id = String(version.id);
    const approval = version.approval as { revokedAt?: Date | null; approvedFingerprint?: string } | null | undefined;
    const currentVersionId = String((version.story as Record<string, unknown>).currentVersionId ?? "");
    if (version.supersededAt || currentVersionId !== id)
      return [{ resultVersionId: id, reason: "SUPERSEDED" as const }];
    if (!approval) return [{ resultVersionId: id, reason: "PENDING_APPROVAL" as const }];
    if (approval.revokedAt) return [{ resultVersionId: id, reason: "REVOKED" as const }];
    if (approval.approvedFingerprint !== fingerprintResultVersion(versionToResultInput(version))) {
      return [{ resultVersionId: id, reason: "SUPERSEDED" as const }];
    }
    return [];
  });
}

async function findEligiblePublicResults(tx: TransactionClient, workspaceId: string, resultVersionIds: string[]) {
  const versions = await tx.studentResultVersion.findMany({
    where: { id: { in: resultVersionIds }, workspaceId, story: { workspaceId } },
    include: { story: { select: { currentVersionId: true } }, metrics: { orderBy: { order: "asc" } }, approval: true },
  });
  const byId = new Map(versions.map((version: Record<string, unknown>) => [String(version.id), version]));
  return resultVersionIds.flatMap((id, index) => {
    const version = byId.get(id);
    if (!version) return [];
    const blockers = publicResultBlockers(version);
    if (blockers.length) return [];
    return [
      {
        publicId: `result-${index + 1}`,
        headline: String(version.headline),
        narrative: (version.narrative as string | null) ?? null,
        testimonial: (version.testimonial as string | null) ?? null,
        attributionMode: version.attributionMode,
        attributionLabel: String(version.attributionLabel ?? "Anónimo"),
        metrics: Array.isArray(version.metrics)
          ? version.metrics.map((metric) => ({
              label: String((metric as Record<string, unknown>).label),
              beforeValue: (metric as Record<string, unknown>).beforeValue,
              afterValue: (metric as Record<string, unknown>).afterValue,
              unit: (metric as Record<string, unknown>).unit,
              order: Number((metric as Record<string, unknown>).order),
            }))
          : [],
      },
    ];
  });
}

function publicResultBlockers(version: Record<string, unknown>): PublicationBlocker[] {
  const id = String(version.id);
  const approval = version.approval as { revokedAt?: Date | null; approvedFingerprint?: string } | null | undefined;
  const currentVersionId = String((version.story as Record<string, unknown>).currentVersionId ?? "");
  if (version.supersededAt || currentVersionId !== id) return [{ resultVersionId: id, reason: "SUPERSEDED" }];
  if (!approval) return [{ resultVersionId: id, reason: "PENDING_APPROVAL" }];
  if (approval.revokedAt) return [{ resultVersionId: id, reason: "REVOKED" }];
  if (approval.approvedFingerprint !== fingerprintResultVersion(versionToResultInput(version))) {
    return [{ resultVersionId: id, reason: "SUPERSEDED" }];
  }
  return [];
}

function publicRevisionId(revision: Record<string, unknown>) {
  return `revision-${String(revision.revisionNumber)}`;
}

function revisionToPublicSource(revision: Record<string, unknown>) {
  return {
    themeKey: revision.themeKey,
    coachDisplayName: revision.coachDisplayName,
    heroEyebrow: revision.heroEyebrow,
    heroHeadline: revision.heroHeadline,
    heroSubheadline: revision.heroSubheadline,
    valueProposition: revision.valueProposition,
    services: Array.isArray(revision.programs)
      ? revision.programs.map((item) => ({
          title: String((item as Record<string, unknown>).title),
          description: String((item as Record<string, unknown>).description),
        }))
      : [],
    methodology: Array.isArray(revision.methodSteps)
      ? revision.methodSteps.map((item) => ({
          title: String((item as Record<string, unknown>).title),
          description: String((item as Record<string, unknown>).description),
        }))
      : [],
    aboutHeading: revision.aboutHeading,
    aboutBody: revision.aboutBody,
    faqs: Array.isArray(revision.faqs)
      ? revision.faqs.map((item) => ({
          question: String((item as Record<string, unknown>).question),
          answer: String((item as Record<string, unknown>).answer),
        }))
      : [],
    ctaHeading: revision.ctaHeading,
    ctaBody: revision.ctaBody,
    whatsappDigits: revision.whatsappDigits,
    whatsappMessage: revision.whatsappMessage,
    seoTitle: revision.seoTitle,
    seoDescription: revision.seoDescription,
  };
}
