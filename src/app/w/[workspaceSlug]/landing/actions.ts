"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LandingContentInput } from "@/modules/marketing/domain/contracts";
import {
  MarketingAccessDeniedError,
  MarketingConflictError,
  MarketingNotFoundError,
  MarketingValidationError,
} from "@/modules/marketing/domain/errors";
import type { MarketingActor } from "@/modules/marketing/application/marketing-service";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export async function saveLandingDraftAction(workspaceSlug: string, data: FormData) {
  const actor = await marketingActorFor(workspaceSlug);
  await marketingService.saveDraft(actor, {
    content: landingContentFromForm(data),
    expectedRevisionNumber: optionalNumber(data, "expectedRevisionNumber"),
    idempotencyKey: text(data, "idempotencyKey"),
    logoAssetId: optional(data, "logoAssetId"),
    portraitAssetId: optional(data, "portraitAssetId"),
    selectedResultVersionIds: csv(data, "selectedResultVersionIds"),
  });
  revalidatePath(`/w/${workspaceSlug}/landing`);
  redirect(`/w/${workspaceSlug}/landing?saved=1`);
}

export async function publishLandingAction(workspaceSlug: string, data: FormData) {
  const actor = await marketingActorFor(workspaceSlug);
  await marketingService.publishLanding(actor, {
    revisionId: text(data, "revisionId"),
    expectedRevisionNumber: number(data, "expectedRevisionNumber"),
    idempotencyKey: text(data, "idempotencyKey"),
  });
  revalidatePath(`/w/${workspaceSlug}/landing`);
  revalidatePath(`/c/${workspaceSlug}`);
  redirect(`/w/${workspaceSlug}/landing?published=1`);
}

export async function unpublishLandingAction(workspaceSlug: string, data: FormData) {
  const actor = await marketingActorFor(workspaceSlug);
  await marketingService.unpublishLanding(actor, {
    expectedPublishedRevisionId: optional(data, "publishedRevisionId"),
    idempotencyKey: text(data, "idempotencyKey"),
  });
  revalidatePath(`/w/${workspaceSlug}/landing`);
  revalidatePath(`/c/${workspaceSlug}`);
  redirect(`/w/${workspaceSlug}/landing?unpublished=1`);
}

async function marketingActorFor(workspaceSlug: string): Promise<MarketingActor> {
  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    return {
      actorId: access.userId,
      workspaceId: access.workspace.workspaceId,
      role: access.workspace.role,
      accessMode: access.workspace.accessMode === "SUPER_ADMIN" ? "WORKSPACE" : undefined,
    };
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof CrossTenantAccessError) throw new MarketingNotFoundError();
    throw error;
  }
}

function landingContentFromForm(data: FormData): LandingContentInput {
  return {
    themeKey: "editorial",
    coachDisplayName: text(data, "coachDisplayName"),
    heroEyebrow: optional(data, "heroEyebrow"),
    heroHeadline: text(data, "heroHeadline"),
    heroSubheadline: text(data, "heroSubheadline"),
    valueProposition: optional(data, "valueProposition"),
    servicesHeading: optional(data, "servicesHeading"),
    services: collection(data, "service", 3),
    methodologyHeading: optional(data, "methodologyHeading"),
    methodology: collection(data, "method", 3),
    resultsHeading: optional(data, "resultsHeading"),
    aboutHeading: optional(data, "aboutHeading"),
    aboutBody: optional(data, "aboutBody"),
    faqHeading: optional(data, "faqHeading"),
    faqs: faqs(data, 3),
    ctaHeading: text(data, "ctaHeading"),
    ctaBody: optional(data, "ctaBody"),
    whatsappDigits: text(data, "whatsappDigits"),
    whatsappMessage: text(data, "whatsappMessage"),
    instagramUrl: optional(data, "instagramUrl"),
    publicEmail: optional(data, "publicEmail"),
    seoTitle: optional(data, "seoTitle"),
    seoDescription: optional(data, "seoDescription"),
    resultAttributionMode: "ANONYMOUS",
  };
}

function collection(data: FormData, prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: optional(data, `${prefix}${index + 1}Title`),
    description: optional(data, `${prefix}${index + 1}Description`),
  })).flatMap((item) => (item.title && item.description ? [{ title: item.title, description: item.description }] : []));
}

function faqs(data: FormData, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    question: optional(data, `faq${index + 1}Question`),
    answer: optional(data, `faq${index + 1}Answer`),
  })).flatMap((item) => (item.question && item.answer ? [{ question: item.question, answer: item.answer }] : []));
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  if (typeof value !== "string" || !value.trim() || value.length > 2000)
    throw new MarketingValidationError("Invalid landing form input");
  return value.trim();
}

function optional(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(data: FormData, key: string) {
  const value = Number(text(data, key));
  if (!Number.isInteger(value) || value < 0) throw new MarketingValidationError("Invalid landing form input");
  return value;
}

function optionalNumber(data: FormData, key: string) {
  const value = optional(data, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new MarketingValidationError("Invalid landing form input");
  return parsed;
}

function csv(data: FormData, key: string) {
  return (optional(data, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function landingActionErrorMessage(error: unknown) {
  if (
    error instanceof MarketingAccessDeniedError ||
    error instanceof MarketingValidationError ||
    error instanceof MarketingConflictError ||
    error instanceof MarketingNotFoundError
  ) {
    return "No pudimos guardar la landing. Revisá los datos y volvé a intentar.";
  }
  throw error;
}
