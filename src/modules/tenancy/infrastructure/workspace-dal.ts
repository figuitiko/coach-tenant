import { headers } from "next/headers";
import { auth } from "@/modules/identity/infrastructure/auth";
import { resolveWorkspaceAccess } from "@/modules/tenancy/application/workspace-access";
import { prisma } from "@/shared/infrastructure/prisma";
import { PrismaWorkspaceRepository } from "./prisma-workspace-repository";

const repository = new PrismaWorkspaceRepository(prisma);

async function sessionIdentity() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { userId: session.user.id } : null;
}

export async function listCurrentMemberships() {
  const session = await sessionIdentity();
  if (!session) return null;
  return { userId: session.userId, memberships: await repository.listMemberships(session.userId) };
}

export async function requireWorkspaceAccess(workspaceSlug: string) {
  const current = await listCurrentMemberships();
  return resolveWorkspaceAccess(
    current ? { userId: current.userId } : null,
    workspaceSlug,
    current?.memberships ?? [],
  );
}
