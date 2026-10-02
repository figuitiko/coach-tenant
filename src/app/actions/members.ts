"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/modules/identity/infrastructure/auth";
import {
  createManualCoachWorkspace,
  createManualStudent,
  MemberCreationError,
} from "@/modules/tenancy/application/member-service";
import { CrossTenantAccessError } from "@/modules/tenancy/application/workspace-access";

const manualStudentSchema = z.object({
  workspaceSlug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const manualCoachWorkspaceSchema = z.object({
  coachName: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  workspaceName: z.string().min(1).max(120),
  timeZone: z.string().min(1).max(80).optional(),
});

async function authenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Authentication required");
  return session.user.id;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof MemberCreationError) return error.message;
  if (error instanceof CrossTenantAccessError) return "No tenés permiso para crear este usuario.";
  return fallback;
}

export async function createManualStudentAction(input: unknown) {
  const actorId = await authenticatedUserId();
  const parsed = manualStudentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Revisá nombre, email y contraseña." };

  try {
    const student = await createManualStudent({ actorId, ...parsed.data });
    revalidatePath(`/w/${parsed.data.workspaceSlug}/students`);
    revalidatePath(`/w/${parsed.data.workspaceSlug}`);
    return { ok: true as const, student };
  } catch (error) {
    return { ok: false as const, message: errorMessage(error, "No pudimos crear el alumno.") };
  }
}

export async function createManualCoachAction(input: unknown) {
  const actorId = await authenticatedUserId();
  const parsed = manualCoachWorkspaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Revisá workspace, nombre, email y contraseña." };

  try {
    const coach = await createManualCoachWorkspace({ actorId, ...parsed.data });
    revalidatePath("/workspace");
    revalidatePath(`/w/${coach.workspaceSlug}`);
    return { ok: true as const, coach };
  } catch (error) {
    return { ok: false as const, message: errorMessage(error, "No pudimos crear el coach.") };
  }
}
