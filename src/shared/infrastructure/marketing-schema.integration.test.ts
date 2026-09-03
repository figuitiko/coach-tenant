import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { deleteWorkspaceMarketingData } from "../../../prisma/marketing-cleanup";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

function isUniqueViolation(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

function isForeignKeyViolation(error: unknown): error is { code: "P2003" } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2003";
}

integration("marketing schema contract against PostgreSQL", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const suffix = Date.now();
  let coachId: string;
  let studentMembershipId: string;
  let studentUserId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const coach = await database.user.create({ data: { name: "Schema Coach", email: `schema-${suffix}-coach@example.test` } });
    const student = await database.user.create({ data: { name: "Schema Student", email: `schema-${suffix}-student@example.test` } });
    const workspace = await database.workspace.create({ data: { slug: `schema-contract-${suffix}`, name: "Schema Contract", ownerId: coach.id } });
    const studentMembership = await database.membership.create({ data: { workspaceId: workspace.id, userId: student.id, role: "STUDENT" } });
    await database.membership.create({ data: { workspaceId: workspace.id, userId: coach.id, role: "COACH" } });
    coachId = coach.id;
    studentUserId = student.id;
    studentMembershipId = studentMembership.id;
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    if (workspaceId) {
      const workspaceFilter = { in: [workspaceId] };
      await deleteWorkspaceMarketingData(database, [workspaceId]);
      await database.membership.deleteMany({ where: { workspaceId: workspaceFilter } });
      await database.workspace.deleteMany({ where: { id: workspaceFilter } });
      await database.user.deleteMany({ where: { id: { in: [coachId, studentUserId] } } });
    }
    await database.$disconnect();
  });

  it("permits at most one landing aggregate per workspace", async () => {
    await database.coachLanding.create({ data: { workspaceId } });
    await expect(database.coachLanding.create({ data: { workspaceId } })).rejects.toSatisfy(isUniqueViolation);
  });

  it("keeps revision numbers immutable and unique per landing, and mutation keys unique per workspace", async () => {
    const landing = await database.coachLanding.findUniqueOrThrow({ where: { workspaceId } });
    const revisionInput = {
      workspaceId,
      landingId: landing.id,
      themeKey: "editorial",
      createdById: coachId,
      payloadHash: "hash-1",
      coachDisplayName: "Coach",
      heroHeadline: "Headline",
      heroSubheadline: "Subheadline",
      ctaHeading: "CTA",
      whatsappDigits: "5215555555555",
      whatsappMessage: "Hola",
    };
    await database.coachLandingRevision.create({ data: { ...revisionInput, revisionNumber: 1, mutationKey: "mutation-1" } });

    await expect(
      database.coachLandingRevision.create({ data: { ...revisionInput, revisionNumber: 1, mutationKey: "mutation-2" } }),
    ).rejects.toSatisfy(isUniqueViolation);

    await expect(
      database.coachLandingRevision.create({ data: { ...revisionInput, revisionNumber: 2, mutationKey: "mutation-1" } }),
    ).rejects.toSatisfy(isUniqueViolation);
  });

  it("lets a landing point its current draft and published revision at a real revision", async () => {
    const landing = await database.coachLanding.findUniqueOrThrow({ where: { workspaceId }, include: { currentDraftRevision: true, publishedRevision: true } });
    const revision = await database.coachLandingRevision.findFirstOrThrow({ where: { landingId: landing.id, revisionNumber: 1 } });

    const updated = await database.coachLanding.update({
      where: { id: landing.id },
      data: { currentDraftRevisionId: revision.id, publishedRevisionId: revision.id, publishedAt: new Date() },
      include: { currentDraftRevision: true, publishedRevision: true },
    });

    expect(updated.currentDraftRevision?.id).toBe(revision.id);
    expect(updated.publishedRevision?.id).toBe(revision.id);
  });

  it("keeps ordered child rows unique per revision and order", async () => {
    const revision = await database.coachLandingRevision.findFirstOrThrow({ where: { workspaceId, revisionNumber: 1 } });
    await database.landingCredibilityFact.create({ data: { revisionId: revision.id, order: 0, label: "Años", value: "10" } });
    await database.landingProgram.create({ data: { revisionId: revision.id, order: 0, title: "Fuerza", description: "Programa" } });
    await database.landingMethodStep.create({ data: { revisionId: revision.id, order: 0, title: "Evaluación", description: "Primer paso" } });
    await database.landingFaq.create({ data: { revisionId: revision.id, order: 0, question: "¿Cómo?", answer: "Con seguimiento" } });
    await expect(
      database.landingCredibilityFact.create({ data: { revisionId: revision.id, order: 0, label: "Otro", value: "5" } }),
    ).rejects.toSatisfy(isUniqueViolation);
    expect(await database.landingProgram.count({ where: { revisionId: revision.id } })).toBe(1);
    expect(await database.landingMethodStep.count({ where: { revisionId: revision.id } })).toBe(1);
    expect(await database.landingFaq.count({ where: { revisionId: revision.id } })).toBe(1);
  });

  it("keeps result version numbers unique per story and mutation keys unique per workspace", async () => {
    const story = await database.studentResultStory.create({ data: { workspaceId, studentMembershipId, createdById: coachId } });
    const versionInput = { workspaceId, storyId: story.id, createdById: coachId, headline: "Bajó 5kg", attributionLabel: "Anónimo", payloadHash: "hash-v1" };
    await database.studentResultVersion.create({ data: { ...versionInput, versionNumber: 1, mutationKey: "version-mutation-1" } });

    await expect(
      database.studentResultVersion.create({ data: { ...versionInput, versionNumber: 1, mutationKey: "version-mutation-2" } }),
    ).rejects.toSatisfy(isUniqueViolation);

    await expect(
      database.studentResultVersion.create({ data: { ...versionInput, versionNumber: 2, mutationKey: "version-mutation-1" } }),
    ).rejects.toSatisfy(isUniqueViolation);
  });

  it("lets a result story point its current version at a real version", async () => {
    const story = await database.studentResultStory.findFirstOrThrow({ where: { workspaceId } });
    const version = await database.studentResultVersion.findFirstOrThrow({ where: { storyId: story.id, versionNumber: 1 } });

    const updated = await database.studentResultStory.update({
      where: { id: story.id },
      data: { currentVersionId: version.id },
      include: { currentVersion: true },
    });

    expect(updated.currentVersion?.id).toBe(version.id);
  });

  it("permits at most one approval per result version", async () => {
    const version = await database.studentResultVersion.findFirstOrThrow({ where: { workspaceId, versionNumber: 1 } });
    await database.studentResultApproval.create({ data: {
      workspaceId, resultVersionId: version.id, studentId: studentUserId, approvedFingerprint: "fp-1", approveMutationKey: "approve-1",
    } });

    await expect(
      database.studentResultApproval.create({ data: {
        workspaceId, resultVersionId: version.id, studentId: studentUserId, approvedFingerprint: "fp-2", approveMutationKey: "approve-2",
      } }),
    ).rejects.toSatisfy(isUniqueViolation);
  });

  it("persists assets, public metric snapshots, and landing result selections", async () => {
    const revision = await database.coachLandingRevision.findFirstOrThrow({ where: { workspaceId, revisionNumber: 1 } });
    const version = await database.studentResultVersion.findFirstOrThrow({ where: { workspaceId, versionNumber: 1 } });
    const intent = await database.marketingAssetUploadIntent.create({ data: {
      workspaceId, createdById: coachId, kind: "LOGO", idempotencyKey: "schema-intent", objectKey: `schema/${suffix}/logo`,
      mimeType: "image/png", sizeBytes: 128, checksumSha256: "d".repeat(64), expiresAt: new Date("2099-01-01"), status: "CONSUMED", consumedAt: new Date(),
    } });
    const asset = await database.marketingAsset.create({ data: {
      workspaceId, kind: "LOGO", objectKey: `schema/${suffix}/logo-final`, mimeType: "image/png", sizeBytes: 128,
      checksumSha256: "d".repeat(64), idempotencyKey: "schema-asset", uploadIntentId: intent.id,
    } });
    await database.coachLandingRevision.update({ where: { id: revision.id }, data: { logoAssetId: asset.id } });
    await database.studentResultMetricSnapshot.create({ data: {
      workspaceId, resultVersionId: version.id, label: "Peso", beforeValue: 74.4, afterValue: 68.4, unit: "KG", order: 0,
    } });
    await database.landingRevisionResult.create({ data: {
      workspaceId, revisionId: revision.id, resultVersionId: version.id, order: 0,
    } });

    const graph = await database.coachLandingRevision.findUniqueOrThrow({
      where: { id: revision.id },
      include: { logoAsset: true, resultSelections: true },
    });
    expect(graph.logoAsset?.id).toBe(asset.id);
    expect(graph.resultSelections.map(({ resultVersionId }) => resultVersionId)).toEqual([version.id]);
    expect(await database.studentResultMetricSnapshot.count({ where: { resultVersionId: version.id } })).toBe(1);
  });

  it("keeps daily landing metrics unique per workspace, revision, and day", async () => {
    const revision = await database.coachLandingRevision.findFirstOrThrow({ where: { workspaceId, revisionNumber: 1 } });
    const day = new Date("2026-08-30T00:00:00.000Z");
    await database.publicLandingMetricDaily.create({ data: { workspaceId, publishedRevisionId: revision.id, day, views: 1 } });

    await expect(
      database.publicLandingMetricDaily.create({ data: { workspaceId, publishedRevisionId: revision.id, day, views: 1 } }),
    ).rejects.toSatisfy(isUniqueViolation);
  });

  it("removes every marketing table in foreign-key-safe order so the workspace can be deleted", async () => {
    await deleteWorkspaceMarketingData(database, [workspaceId]);

    expect(await database.coachLanding.count({ where: { workspaceId } })).toBe(0);
    expect(await database.coachLandingRevision.count({ where: { workspaceId } })).toBe(0);
    expect(await database.landingCredibilityFact.count({ where: { revision: { workspaceId } } })).toBe(0);
    expect(await database.landingProgram.count({ where: { revision: { workspaceId } } })).toBe(0);
    expect(await database.landingMethodStep.count({ where: { revision: { workspaceId } } })).toBe(0);
    expect(await database.landingFaq.count({ where: { revision: { workspaceId } } })).toBe(0);
    expect(await database.landingRevisionResult.count({ where: { workspaceId } })).toBe(0);
    expect(await database.studentResultStory.count({ where: { workspaceId } })).toBe(0);
    expect(await database.studentResultVersion.count({ where: { workspaceId } })).toBe(0);
    expect(await database.studentResultApproval.count({ where: { workspaceId } })).toBe(0);
    expect(await database.studentResultMetricSnapshot.count({ where: { workspaceId } })).toBe(0);
    expect(await database.marketingAsset.count({ where: { workspaceId } })).toBe(0);
    expect(await database.marketingAssetUploadIntent.count({ where: { workspaceId } })).toBe(0);
    expect(await database.publicLandingMetricDaily.count({ where: { workspaceId } })).toBe(0);
    await database.membership.deleteMany({ where: { workspaceId } });
    await database.workspace.delete({ where: { id: workspaceId } });
    expect(await database.workspace.count({ where: { id: workspaceId } })).toBe(0);
  });
});

integration("marketing schema tenant boundaries against PostgreSQL", () => {
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const suffix = `${Date.now()}-tenant`;
  const ids = {
    coachA: `marketing-${suffix}-coach-a`,
    coachB: `marketing-${suffix}-coach-b`,
    studentA: `marketing-${suffix}-student-a`,
    studentB: `marketing-${suffix}-student-b`,
    workspaceA: `marketing-${suffix}-workspace-a`,
    workspaceB: `marketing-${suffix}-workspace-b`,
    membershipA: `marketing-${suffix}-membership-a`,
    membershipB: `marketing-${suffix}-membership-b`,
    landingA: `marketing-${suffix}-landing-a`,
    landingB: `marketing-${suffix}-landing-b`,
    revisionA: `marketing-${suffix}-revision-a`,
    revisionB: `marketing-${suffix}-revision-b`,
    storyA: `marketing-${suffix}-story-a`,
    storyB: `marketing-${suffix}-story-b`,
    versionA: `marketing-${suffix}-version-a`,
    versionB: `marketing-${suffix}-version-b`,
    intentA: `marketing-${suffix}-intent-a`,
    intentB: `marketing-${suffix}-intent-b`,
    unusedIntentB: `marketing-${suffix}-intent-b-unused`,
    assetA: `marketing-${suffix}-asset-a`,
    assetB: `marketing-${suffix}-asset-b`,
  };

  const revisionData = (workspaceId: string, landingId: string, createdById: string, id: string) => ({
    id,
    workspaceId,
    landingId,
    revisionNumber: 1,
    themeKey: "editorial",
    createdById,
    mutationKey: `${id}-mutation`,
    payloadHash: `${id}-hash`,
    coachDisplayName: "Coach",
    heroHeadline: "Headline",
    heroSubheadline: "Subheadline",
    ctaHeading: "CTA",
    whatsappDigits: "5215555555555",
    whatsappMessage: "Hola",
  });

  beforeAll(async () => {
    await database.user.createMany({ data: [
      { id: ids.coachA, name: "Coach A", email: `${ids.coachA}@example.test` },
      { id: ids.coachB, name: "Coach B", email: `${ids.coachB}@example.test` },
      { id: ids.studentA, name: "Student A", email: `${ids.studentA}@example.test` },
      { id: ids.studentB, name: "Student B", email: `${ids.studentB}@example.test` },
    ] });
    await database.workspace.createMany({ data: [
      { id: ids.workspaceA, slug: ids.workspaceA, name: "Workspace A", ownerId: ids.coachA },
      { id: ids.workspaceB, slug: ids.workspaceB, name: "Workspace B", ownerId: ids.coachB },
    ] });
    await database.membership.createMany({ data: [
      { id: ids.membershipA, workspaceId: ids.workspaceA, userId: ids.studentA, role: "STUDENT" },
      { id: ids.membershipB, workspaceId: ids.workspaceB, userId: ids.studentB, role: "STUDENT" },
    ] });
    await database.coachLanding.createMany({ data: [
      { id: ids.landingA, workspaceId: ids.workspaceA },
      { id: ids.landingB, workspaceId: ids.workspaceB },
    ] });
    await database.marketingAssetUploadIntent.createMany({ data: [
      { id: ids.intentA, workspaceId: ids.workspaceA, createdById: ids.coachA, kind: "LOGO", idempotencyKey: ids.intentA, objectKey: ids.intentA, mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64), expiresAt: new Date("2099-01-01") },
      { id: ids.intentB, workspaceId: ids.workspaceB, createdById: ids.coachB, kind: "LOGO", idempotencyKey: ids.intentB, objectKey: ids.intentB, mimeType: "image/png", sizeBytes: 10, checksumSha256: "b".repeat(64), expiresAt: new Date("2099-01-01") },
      { id: ids.unusedIntentB, workspaceId: ids.workspaceB, createdById: ids.coachB, kind: "LOGO", idempotencyKey: ids.unusedIntentB, objectKey: ids.unusedIntentB, mimeType: "image/png", sizeBytes: 10, checksumSha256: "b".repeat(64), expiresAt: new Date("2099-01-01") },
    ] });
    await database.marketingAsset.createMany({ data: [
      { id: ids.assetA, workspaceId: ids.workspaceA, kind: "LOGO", objectKey: `${ids.assetA}-object`, mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64), idempotencyKey: ids.assetA, uploadIntentId: ids.intentA },
      { id: ids.assetB, workspaceId: ids.workspaceB, kind: "LOGO", objectKey: `${ids.assetB}-object`, mimeType: "image/png", sizeBytes: 10, checksumSha256: "b".repeat(64), idempotencyKey: ids.assetB, uploadIntentId: ids.intentB },
    ] });
    await database.coachLandingRevision.createMany({ data: [
      revisionData(ids.workspaceA, ids.landingA, ids.coachA, ids.revisionA),
      revisionData(ids.workspaceB, ids.landingB, ids.coachB, ids.revisionB),
    ] });
    await database.studentResultStory.createMany({ data: [
      { id: ids.storyA, workspaceId: ids.workspaceA, studentMembershipId: ids.membershipA, createdById: ids.coachA },
      { id: ids.storyB, workspaceId: ids.workspaceB, studentMembershipId: ids.membershipB, createdById: ids.coachB },
    ] });
    await database.studentResultVersion.createMany({ data: [
      { id: ids.versionA, workspaceId: ids.workspaceA, storyId: ids.storyA, versionNumber: 1, createdById: ids.coachA, headline: "A", attributionLabel: "Anonymous", mutationKey: ids.versionA, payloadHash: `${ids.versionA}-hash` },
      { id: ids.versionB, workspaceId: ids.workspaceB, storyId: ids.storyB, versionNumber: 1, createdById: ids.coachB, headline: "B", attributionLabel: "Anonymous", mutationKey: ids.versionB, payloadHash: `${ids.versionB}-hash` },
    ] });
  });

  afterAll(async () => {
    const prefix = `marketing-${suffix}`;
    await deleteWorkspaceMarketingData(database, [ids.workspaceA, ids.workspaceB]);
    await database.membership.deleteMany({ where: { id: { startsWith: prefix } } });
    await database.workspace.deleteMany({ where: { id: { startsWith: prefix } } });
    await database.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await database.$disconnect();
  });

  it("rejects a landing pointer to another workspace revision", async () => {
    await expect(database.coachLanding.update({ where: { id: ids.landingA }, data: { currentDraftRevisionId: ids.revisionB } })).rejects.toSatisfy(isForeignKeyViolation);
    await expect(database.coachLanding.update({ where: { id: ids.landingA }, data: { publishedRevisionId: ids.revisionB } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects a revision attached to another workspace landing or asset", async () => {
    await expect(database.coachLandingRevision.create({ data: { ...revisionData(ids.workspaceA, ids.landingB, ids.coachA, `${ids.revisionA}-foreign-landing`), revisionNumber: 2 } })).rejects.toSatisfy(isForeignKeyViolation);
    await expect(database.coachLandingRevision.update({ where: { id: ids.revisionA }, data: { logoAssetId: ids.assetB } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects a marketing asset attached to another workspace upload intent", async () => {
    await expect(database.marketingAsset.create({ data: { id: `${ids.assetA}-foreign-intent`, workspaceId: ids.workspaceA, kind: "LOGO", objectKey: `${ids.assetA}-foreign-intent`, mimeType: "image/png", sizeBytes: 10, checksumSha256: "c".repeat(64), idempotencyKey: `${ids.assetA}-foreign-intent`, uploadIntentId: ids.unusedIntentB } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects a story attached to another workspace membership", async () => {
    await expect(database.studentResultStory.create({ data: { id: `${ids.storyA}-foreign-membership`, workspaceId: ids.workspaceA, studentMembershipId: ids.membershipB, createdById: ids.coachA } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects a version attached to another workspace story", async () => {
    await expect(database.studentResultVersion.create({ data: { id: `${ids.versionA}-foreign-story`, workspaceId: ids.workspaceA, storyId: ids.storyB, versionNumber: 2, createdById: ids.coachA, headline: "Foreign", attributionLabel: "Anonymous", mutationKey: `${ids.versionA}-foreign-story`, payloadHash: "foreign" } })).rejects.toSatisfy(isForeignKeyViolation);
    await expect(database.studentResultStory.update({ where: { id: ids.storyA }, data: { currentVersionId: ids.versionB } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects an approval for a foreign version or non-member student", async () => {
    await expect(database.studentResultApproval.create({ data: { id: `${ids.versionA}-foreign-approval`, workspaceId: ids.workspaceA, resultVersionId: ids.versionB, studentId: ids.studentA, approvedFingerprint: "foreign", approveMutationKey: `${ids.versionA}-foreign-approval` } })).rejects.toSatisfy(isForeignKeyViolation);
    await expect(database.studentResultApproval.create({ data: { id: `${ids.versionA}-foreign-student`, workspaceId: ids.workspaceA, resultVersionId: ids.versionA, studentId: ids.studentB, approvedFingerprint: "foreign", approveMutationKey: `${ids.versionA}-foreign-student` } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects selecting a foreign result version in a landing revision", async () => {
    await expect(database.landingRevisionResult.create({ data: { id: `${ids.revisionA}-foreign-result`, workspaceId: ids.workspaceA, revisionId: ids.revisionA, order: 0, resultVersionId: ids.versionB } })).rejects.toSatisfy(isForeignKeyViolation);
  });

  it("rejects metrics attached to a foreign result or landing revision", async () => {
    await expect(database.studentResultMetricSnapshot.create({ data: { id: `${ids.versionA}-foreign-metric`, workspaceId: ids.workspaceA, resultVersionId: ids.versionB, label: "Weight", beforeValue: 80, afterValue: 75, unit: "KG", order: 0 } })).rejects.toSatisfy(isForeignKeyViolation);
    await expect(database.publicLandingMetricDaily.create({ data: { id: `${ids.revisionA}-foreign-daily`, workspaceId: ids.workspaceA, publishedRevisionId: ids.revisionB, day: new Date("2026-08-31"), views: 1 } })).rejects.toSatisfy(isForeignKeyViolation);
  });
});
