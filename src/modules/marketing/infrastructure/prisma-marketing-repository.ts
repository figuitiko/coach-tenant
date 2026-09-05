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
} from "../application/marketing-service";
import type { LandingContentInput } from "../domain/contracts";
import { MarketingAccessDeniedError, MarketingConflictError, MarketingNotFoundError } from "../domain/errors";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type HashFunction = (value: unknown) => string;

type IdempotentOutput = LandingMutationResult | UnpublishLandingResult;

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
      content: command.content,
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
      content: command.content,
    });
    const dedupeKey = mutationKey(actor, "publishLanding", command.idempotencyKey);

    return this.transaction(async (tx) => {
      await assertLandingAuthor(tx, actor);
      const replay = await resolveReplay<LandingMutationResult>(tx, actor.workspaceId, dedupeKey, payloadHash);
      if (replay) return replay;
      const landing = await tx.coachLanding.findUnique({
        where: { workspaceId: actor.workspaceId },
        include: { currentDraftRevision: { select: { id: true, revisionNumber: true } } },
      });
      if (!landing || landing.currentDraftRevision?.id !== command.revisionId) throw new MarketingNotFoundError();
      if (landing.currentDraftRevision.revisionNumber !== command.expectedRevisionNumber)
        throw new MarketingConflictError("Stale landing revision");
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
