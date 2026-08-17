"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/modules/identity/infrastructure/auth";
import { invitationService } from "@/modules/tenancy/infrastructure/invitation-use-cases";

const createSchema = z.object({
  workspaceSlug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  expiresAt: z.coerce.date(),
});
const idSchema = z.string().cuid();
const tokenSchema = z.string().min(32).max(256);

async function authenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Authentication required");
  return session.user.id;
}

export async function createInvitationAction(input: unknown) {
  const actorId = await authenticatedUserId();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "No pudimos crear la invitación." };
  try {
    const invitation = await invitationService.create({ actorId, ...parsed.data });
    return { ok: true as const, invitation };
  } catch {
    return { ok: false as const, message: "No pudimos crear la invitación." };
  }
}

export async function revokeInvitationAction(invitationId: string) {
  const actorId = await authenticatedUserId();
  const parsed = idSchema.safeParse(invitationId);
  if (!parsed.success) return { ok: false as const, message: "No pudimos revocar la invitación." };
  try {
    await invitationService.revoke({ actorId, invitationId: parsed.data });
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "No pudimos revocar la invitación." };
  }
}

export async function acceptInvitationAction(rawToken: string) {
  const userId = await authenticatedUserId();
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) redirect("/workspace?invite=unavailable");
  let workspaceSlug: string;
  try {
    const accepted = await invitationService.accept({ userId, rawToken: parsed.data });
    workspaceSlug = accepted.workspaceSlug;
  } catch {
    redirect("/workspace?invite=unavailable");
  }
  redirect(`/w/${workspaceSlug}`);
}
