import { createHash, randomBytes } from "node:crypto";

export type InvitationRecord = {
  workspaceId: string;
  invitedById: string;
  tokenHash: string;
  role: "STUDENT";
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  acceptedById: string | null;
  revokedAt: Date | null;
};

export class InvitationUnavailableError extends Error {
  constructor() {
    super("Invitation is unavailable");
    this.name = "InvitationUnavailableError";
  }
}

export function hashInvitationToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function issueInvitation(input: {
  workspaceId: string;
  invitedById: string;
  expiresAt: Date;
  now?: Date;
  generateToken?: () => string;
}) {
  const now = input.now ?? new Date();
  if (input.expiresAt <= now) throw new Error("Invitation expiry must be in the future");
  const rawToken = (input.generateToken ?? (() => randomBytes(32).toString("base64url")))();
  return {
    rawToken,
    invitation: {
      workspaceId: input.workspaceId,
      invitedById: input.invitedById,
      tokenHash: hashInvitationToken(rawToken),
      role: "STUDENT" as const,
      expiresAt: input.expiresAt,
      createdAt: now,
      acceptedAt: null,
      acceptedById: null,
      revokedAt: null,
    } satisfies InvitationRecord,
  };
}

export function acceptInvitation(
  invitation: InvitationRecord,
  userId: string,
  now = new Date(),
): InvitationRecord {
  if (invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= now) {
    throw new InvitationUnavailableError();
  }
  return { ...invitation, acceptedAt: now, acceptedById: userId };
}

export function revokeInvitation(invitation: InvitationRecord, now = new Date()): InvitationRecord {
  if (invitation.acceptedAt) throw new InvitationUnavailableError();
  return { ...invitation, revokedAt: invitation.revokedAt ?? now };
}
