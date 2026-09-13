"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MarketingActor } from "@/modules/marketing/application/marketing-service";
import {
  MarketingAccessDeniedError,
  MarketingConflictError,
  MarketingNotFoundError,
} from "@/modules/marketing/domain/errors";
import { marketingService } from "@/modules/marketing/infrastructure/marketing-use-cases";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export async function approveResultAction(workspaceSlug: string, data: FormData) {
  try {
    const actor = await studentActorFor(workspaceSlug);
    await marketingService.approveResultVersion(actor, {
      resultVersionId: text(data, "resultVersionId"),
      fingerprint: text(data, "fingerprint"),
      idempotencyKey: text(data, "idempotencyKey"),
    });
    revalidatePath(`/w/${workspaceSlug}/results`);
    redirect(`/w/${workspaceSlug}/results?approved=1`);
  } catch (error) {
    handleResultActionError(error, workspaceSlug);
  }
}

export async function revokeResultAction(workspaceSlug: string, data: FormData) {
  try {
    const actor = await studentActorFor(workspaceSlug);
    await marketingService.revokeResultVersion(actor, {
      resultVersionId: text(data, "resultVersionId"),
      idempotencyKey: text(data, "idempotencyKey"),
    });
    revalidatePath(`/w/${workspaceSlug}/results`);
    revalidatePath(`/c/${workspaceSlug}`);
    redirect(`/w/${workspaceSlug}/results?revoked=1`);
  } catch (error) {
    handleResultActionError(error, workspaceSlug);
  }
}

async function studentActorFor(workspaceSlug: string): Promise<MarketingActor> {
  const access = await requireWorkspaceAccess(workspaceSlug);
  return { actorId: access.userId, workspaceId: access.workspace.workspaceId, role: access.workspace.role };
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  if (typeof value !== "string" || !value.trim() || value.length > 500)
    throw new MarketingConflictError("Invalid result action");
  return value.trim();
}

function handleResultActionError(error: unknown, workspaceSlug: string): never {
  if (error instanceof UnauthenticatedError) redirect("/sign-in");
  if (
    error instanceof CrossTenantAccessError ||
    error instanceof MarketingAccessDeniedError ||
    error instanceof MarketingNotFoundError
  ) {
    redirect(`/w/${workspaceSlug}/results?error=not-found`);
  }
  if (error instanceof MarketingConflictError) redirect(`/w/${workspaceSlug}/results?error=conflict`);
  throw error;
}
