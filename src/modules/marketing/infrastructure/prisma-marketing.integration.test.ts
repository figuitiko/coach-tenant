import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deleteWorkspaceMarketingData } from "../../../../prisma/marketing-cleanup";
import { MarketingService, type MarketingActor } from "../application/marketing-service";
import { fingerprintResultVersion, type LandingContentInput, type ResultVersionInput } from "../domain/contracts";
import { MarketingAccessDeniedError, MarketingPublicationBlockedError } from "../domain/errors";
import { PrismaMarketingRepository } from "./prisma-marketing-repository";

const connectionString = process.env.TEST_DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const service = new MarketingService(new PrismaMarketingRepository(prisma));

const landingContent = (name: string, overrides: Partial<LandingContentInput> = {}): LandingContentInput => ({
  themeKey: "editorial",
  coachDisplayName: name,
  heroEyebrow: "Coaching personalizado",
  heroHeadline: `${name} transforma tu entrenamiento`,
  heroSubheadline: "Planes claros, seguimiento semanal y resultados medibles.",
  servicesHeading: "Programas",
  services: [{ title: "Plan online", description: "Rutina semanal con revisión del coach." }],
  methodologyHeading: "Método",
  methodology: [{ title: "Diagnóstico", description: "Medimos el punto de partida y ajustamos el plan." }],
  resultsHeading: "Resultados reales",
  aboutHeading: "Sobre el coach",
  aboutBody: "Acompañamiento simple para entrenar con dirección.",
  faqHeading: "Preguntas frecuentes",
  faqs: [{ question: "¿Cómo empiezo?", answer: "Escribime por WhatsApp y coordinamos." }],
  ctaHeading: "Empezá hoy",
  ctaBody: "Mandame un mensaje y vemos tu objetivo.",
  whatsappDigits: "5215555555555",
  whatsappMessage: "Hola, quiero entrenar",
  seoTitle: `${name} coaching online`,
  seoDescription: "Entrenamiento personalizado con seguimiento.",
  ...overrides,
});

const resultContent = (headline = "Bajó 6 kg sin dejar de entrenar fuerte"): ResultVersionInput => ({
  headline,
  narrative: "Sostuvo tres sesiones semanales durante el proceso.",
  testimonial: "Ahora entreno con más confianza.",
  attributionMode: "ANONYMOUS",
  attributionLabel: "Anónimo",
  metrics: [{ label: "Peso", beforeValue: 90, afterValue: 84, unit: "KG", order: 0 }],
});

describe("PrismaMarketingRepository PostgreSQL boundaries", () => {
  beforeEach(async () => {
    const workspaceIds = (await prisma.workspace.findMany({ select: { id: true } })).map(({ id }) => id);
    await deleteWorkspaceMarketingData(prisma, workspaceIds);
    await prisma.reviewReply.deleteMany();
    await prisma.reviewNote.deleteMany();
    await prisma.progressPhoto.deleteMany();
    await prisma.measurementCheckIn.deleteMany();
    await prisma.setLog.deleteMany();
    await prisma.exerciseLog.deleteMany();
    await prisma.workoutSession.deleteMany();
    await prisma.assignedExercise.deleteMany();
    await prisma.assignedWorkout.deleteMany();
    await prisma.studentPlanAssignment.deleteMany();
    await prisma.planWorkout.deleteMany();
    await prisma.workoutPlan.deleteMany();
    await prisma.templateExercise.deleteMany();
    await prisma.workoutTemplate.deleteMany();
    await prisma.exercise.deleteMany();
    await prisma.productEvent.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.invitation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(() => prisma.$disconnect());

  it("rejects an ordinary coach using another workspace context", async () => {
    const { a, b } = await twoTenantFixture("coach-boundary");

    await expect(
      service.saveDraft(
        { actorId: a.coach.id, workspaceId: b.workspace.id, role: "COACH" },
        { content: landingContent("Cross tenant"), idempotencyKey: "cross-tenant-draft" },
      ),
    ).rejects.toBeInstanceOf(MarketingAccessDeniedError);

    expect(await prisma.coachLandingRevision.count({ where: { workspaceId: b.workspace.id } })).toBe(0);
  });

  it("keeps the previous public landing when publishing a draft blocked by pending consent", async () => {
    const { a } = await twoTenantFixture("blocked-publish");
    const coach = coachActor(a);

    const first = await service.saveDraft(coach, {
      content: landingContent("Fuerza Norte", { heroHeadline: "Landing vigente" }),
      idempotencyKey: "draft-current",
    });
    await service.publishLanding(coach, {
      revisionId: first.revisionId,
      expectedRevisionNumber: first.revisionNumber,
      idempotencyKey: "publish-current",
    });

    const pending = await service.requestResultApproval(coach, {
      studentMembershipId: a.studentMembership.id,
      content: resultContent(),
      idempotencyKey: "pending-result",
    });
    const blockedDraft = await service.saveDraft(coach, {
      content: landingContent("Fuerza Norte", { heroHeadline: "Landing bloqueada" }),
      expectedRevisionNumber: first.revisionNumber,
      selectedResultVersionIds: [pending.versionId],
      idempotencyKey: "draft-blocked",
    });

    await expect(
      service.publishLanding(coach, {
        revisionId: blockedDraft.revisionId,
        expectedRevisionNumber: blockedDraft.revisionNumber,
        idempotencyKey: "publish-blocked",
      }),
    ).rejects.toBeInstanceOf(MarketingPublicationBlockedError);

    const persisted = await prisma.coachLanding.findUniqueOrThrow({ where: { workspaceId: a.workspace.id } });
    expect(persisted.publishedRevisionId).toBe(first.revisionId);
    await expect(service.getPublishedLanding(a.workspace.slug)).resolves.toMatchObject({
      hero: { headline: "Landing vigente" },
      results: [],
    });
  });

  it("publishes only exact approved result versions and removes them from public reads after revocation", async () => {
    const { a } = await twoTenantFixture("result-revocation");
    const coach = coachActor(a);
    const student = studentActor(a);
    const result = await service.requestResultApproval(coach, {
      studentMembershipId: a.studentMembership.id,
      content: resultContent("Resultado aprobado"),
      idempotencyKey: "result-request",
    });
    await service.approveResultVersion(student, {
      resultVersionId: result.versionId,
      fingerprint: result.fingerprint,
      idempotencyKey: "approve-result",
    });
    const draft = await service.saveDraft(coach, {
      content: landingContent("Fuerza Norte"),
      selectedResultVersionIds: [result.versionId],
      idempotencyKey: "draft-with-result",
    });
    await service.publishLanding(coach, {
      revisionId: draft.revisionId,
      expectedRevisionNumber: draft.revisionNumber,
      idempotencyKey: "publish-with-result",
    });

    await expect(service.getPublishedLanding(a.workspace.slug)).resolves.toMatchObject({
      results: [expect.objectContaining({ headline: "Resultado aprobado", attributionLabel: "Anónimo" })],
    });

    await service.revokeResultVersion(student, { resultVersionId: result.versionId, idempotencyKey: "revoke-result" });

    await expect(service.getPublishedLanding(a.workspace.slug)).resolves.toMatchObject({ results: [] });
  });

  it("returns an allowlisted public DTO without private ids, object keys, or Decimal objects", async () => {
    const { a } = await twoTenantFixture("public-dto");
    const coach = coachActor(a);
    const student = studentActor(a);
    const resultInput = resultContent("Métrica serializable");
    const requested = await service.requestResultApproval(coach, {
      studentMembershipId: a.studentMembership.id,
      content: resultInput,
      idempotencyKey: "dto-result",
    });
    await service.approveResultVersion(student, {
      resultVersionId: requested.versionId,
      fingerprint: fingerprintResultVersion(resultInput),
      idempotencyKey: "dto-approve",
    });
    const draft = await service.saveDraft(coach, {
      content: landingContent("Fuerza Norte"),
      selectedResultVersionIds: [requested.versionId],
      idempotencyKey: "dto-draft",
    });
    await service.publishLanding(coach, {
      revisionId: draft.revisionId,
      expectedRevisionNumber: draft.revisionNumber,
      idempotencyKey: "dto-publish",
    });

    const dto = await service.getPublishedLanding(a.workspace.slug);
    const json = JSON.stringify(dto);

    expect(dto?.results[0].metrics[0]).toEqual({ label: "Peso", before: "90.00", after: "84.00", unit: "KG" });
    expect(json).not.toContain(a.workspace.id);
    expect(json).not.toContain(a.student.id);
    expect(json).not.toContain(a.studentMembership.id);
    expect(json).not.toContain(requested.versionId);
    expect(json).not.toContain("objectKey");
  });

  it("aggregates concurrent public metrics against the current published revision only", async () => {
    const { a } = await twoTenantFixture("metrics");
    const coach = coachActor(a);
    const first = await service.saveDraft(coach, {
      content: landingContent("Fuerza Norte"),
      idempotencyKey: "metrics-draft",
    });
    await service.publishLanding(coach, {
      revisionId: first.revisionId,
      expectedRevisionNumber: first.revisionNumber,
      idempotencyKey: "metrics-publish",
    });

    const outcomes = await Promise.allSettled([
      ...Array.from({ length: 5 }, () => service.recordPublicLandingMetric(a.workspace.slug, "VIEW")),
      ...Array.from({ length: 3 }, () => service.recordPublicLandingMetric(a.workspace.slug, "WHATSAPP_CLICK")),
    ]);

    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(await prisma.publicLandingMetricDaily.findMany({ where: { workspaceId: a.workspace.id } })).toEqual([
      expect.objectContaining({
        workspaceId: a.workspace.id,
        publishedRevisionId: first.revisionId,
        views: 5,
        whatsappClicks: 3,
      }),
    ]);
  });
});

type TenantFixture = Awaited<ReturnType<typeof tenantFixture>>;

async function twoTenantFixture(suffix: string) {
  const a = await tenantFixture(`${suffix}-a`);
  const b = await tenantFixture(`${suffix}-b`);
  return { a, b };
}

async function tenantFixture(suffix: string) {
  const coach = await prisma.user.create({ data: { name: `Coach ${suffix}`, email: `coach-${suffix}@test.local` } });
  const student = await prisma.user.create({
    data: { name: `Student ${suffix}`, email: `student-${suffix}@test.local` },
  });
  const workspace = await prisma.workspace.create({
    data: { name: `Workspace ${suffix}`, slug: `workspace-${suffix}`, ownerId: coach.id },
  });
  const coachMembership = await prisma.membership.create({
    data: { workspaceId: workspace.id, userId: coach.id, role: "COACH" },
  });
  const studentMembership = await prisma.membership.create({
    data: { workspaceId: workspace.id, userId: student.id, role: "STUDENT" },
  });
  return { coach, student, workspace, coachMembership, studentMembership };
}

function coachActor(fixture: TenantFixture): MarketingActor {
  return { actorId: fixture.coach.id, workspaceId: fixture.workspace.id, role: "COACH" };
}

function studentActor(fixture: TenantFixture): MarketingActor {
  return { actorId: fixture.student.id, workspaceId: fixture.workspace.id, role: "STUDENT" };
}
