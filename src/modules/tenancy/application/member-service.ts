import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/shared/infrastructure/prisma";
import { CrossTenantAccessError } from "@/modules/tenancy/application/workspace-access";
import { isWorkspaceRoleAuthorized } from "@/modules/tenancy/infrastructure/workspace-role-authorization";

export class MemberCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberCreationError";
  }
}

export type ManualStudentInput = {
  actorId: string;
  workspaceSlug: string;
  name: string;
  email: string;
  password: string;
};

export type ManualCoachWorkspaceInput = {
  actorId: string;
  coachName: string;
  email: string;
  password: string;
  workspaceName: string;
  timeZone?: string;
};

export async function createManualStudent(input: ManualStudentInput) {
  const email = normalizeEmail(input.email);
  const name = normalizeRequiredText(input.name, "Name is required");
  const password = normalizePassword(input.password);

  const workspace = await prisma.workspace.findUnique({
    where: { slug: input.workspaceSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!workspace) throw new CrossTenantAccessError("Workspace access denied");

  if (!(await isWorkspaceRoleAuthorized(prisma, workspace.id, input.actorId, "COACH"))) {
    throw new CrossTenantAccessError("Workspace access denied");
  }

  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (transaction) => {
    const user = await upsertCredentialUser(transaction, { email, name, passwordHash });

    const membership = await transaction.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "STUDENT",
      },
      update: {
        role: "STUDENT",
      },
      select: { id: true, role: true },
    });

    await transaction.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        actorId: input.actorId,
        action: "student.created_manually",
        entityType: "Membership",
        entityId: membership.id,
        metadata: { userId: user.id, email: user.email },
      },
    });

    await transaction.productEvent.create({
      data: {
        workspaceId: workspace.id,
        userId: input.actorId,
        name: "student_created_manually",
        properties: { membershipId: membership.id },
      },
    });

    return {
      id: membership.id,
      role: membership.role,
      name: user.name,
      email: user.email,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
    };
  });
}

export async function createManualCoachWorkspace(input: ManualCoachWorkspaceInput) {
  const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { platformRole: true } });
  if (actor?.platformRole !== "SUPER_ADMIN") throw new CrossTenantAccessError("Workspace access denied");

  const email = normalizeEmail(input.email);
  const coachName = normalizeRequiredText(input.coachName, "Coach name is required");
  const workspaceName = normalizeRequiredText(input.workspaceName, "Workspace name is required");
  const password = normalizePassword(input.password);
  const timeZone = input.timeZone?.trim() || "America/Mexico_City";
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { platformRole: true } });
  if (existingUser?.platformRole === "SUPER_ADMIN") {
    throw new MemberCreationError("Use a coach email, not the super admin email");
  }

  const passwordHash = await hashPassword(password);
  const workspaceSlug = await nextAvailableWorkspaceSlug(workspaceName);

  return prisma.$transaction(async (transaction) => {
    const coach = await upsertCredentialUser(transaction, { email, name: coachName, passwordHash });

    const workspace = await transaction.workspace.create({
      data: {
        slug: workspaceSlug,
        name: workspaceName,
        timeZone,
        ownerId: coach.id,
      },
      select: { id: true, slug: true, name: true },
    });

    const membership = await transaction.membership.create({
      data: {
        workspaceId: workspace.id,
        userId: coach.id,
        role: "COACH",
      },
      select: { id: true, role: true },
    });

    await transaction.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        actorId: input.actorId,
        action: "coach_workspace.created_manually",
        entityType: "Workspace",
        entityId: workspace.id,
        metadata: { userId: coach.id, email: coach.email, membershipId: membership.id },
      },
    });

    await transaction.productEvent.create({
      data: {
        workspaceId: workspace.id,
        userId: input.actorId,
        name: "coach_workspace_created_manually",
        properties: { membershipId: membership.id },
      },
    });

    return {
      id: membership.id,
      role: membership.role,
      name: coach.name,
      email: coach.email,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
    };
  });
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function upsertCredentialUser(
  transaction: TransactionClient,
  input: { email: string; name: string; passwordHash: string },
) {
  const user = await transaction.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      emailVerified: true,
    },
    update: {
      name: input.name,
      emailVerified: true,
    },
    select: { id: true, name: true, email: true },
  });

  await transaction.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    create: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: input.passwordHash,
    },
    update: {
      password: input.passwordHash,
    },
  });

  return user;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new MemberCreationError("Valid email is required");
  return email;
}

function normalizeRequiredText(value: string, message: string) {
  const text = value.trim();
  if (!text) throw new MemberCreationError(message);
  return text;
}

function normalizePassword(value: string) {
  const password = value.trim();
  if (password.length < 8) throw new MemberCreationError("Password must have at least 8 characters");
  return password;
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "coach-workspace";
}

async function nextAvailableWorkspaceSlug(workspaceName: string) {
  const base = slugify(workspaceName);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  throw new MemberCreationError("Could not create a unique workspace slug");
}
