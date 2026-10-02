"use server";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/modules/identity/infrastructure/auth";
import { CrossTenantAccessError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";
import { prisma } from "@/shared/infrastructure/prisma";

const changePasswordSchema = z
  .object({
    workspaceSlug: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Las contraseñas nuevas no coinciden.",
    path: ["confirmPassword"],
  });

async function authenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Authentication required");
  return session.user.id;
}

export async function changePasswordAction(input: unknown) {
  const userId = await authenticatedUserId();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Revisá las contraseñas." };

  try {
    const access = await requireWorkspaceAccess(parsed.data.workspaceSlug);
    if (access.userId !== userId) return { ok: false as const, message: "No pudimos validar tu sesión." };

    const account = await prisma.account.findUnique({
      where: { providerId_accountId: { providerId: "credential", accountId: userId } },
      select: { id: true, password: true },
    });

    if (!account?.password)
      return { ok: false as const, message: "Esta cuenta no tiene contraseña local configurada." };

    const validCurrentPassword = await verifyPassword({
      hash: account.password,
      password: parsed.data.currentPassword,
    });
    if (!validCurrentPassword) return { ok: false as const, message: "La contraseña actual no es correcta." };

    const nextPasswordHash = await hashPassword(parsed.data.newPassword);
    await prisma.account.update({
      where: { id: account.id },
      data: { password: nextPasswordHash },
    });

    return { ok: true as const };
  } catch (error) {
    if (error instanceof CrossTenantAccessError)
      return { ok: false as const, message: "No tenés acceso a este workspace." };
    return { ok: false as const, message: "No pudimos cambiar la contraseña." };
  }
}
