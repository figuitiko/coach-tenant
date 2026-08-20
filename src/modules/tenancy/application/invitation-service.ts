import { hashInvitationToken, issueInvitation } from "@/modules/tenancy/domain/invitation";

export type CreateInvitationRecordInput = {
  actorId: string;
  workspaceSlug: string;
  tokenHash: string;
  role: "STUDENT";
  expiresAt: Date;
  createdAt: Date;
};

export type InvitationRecordSummary = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type InvitationSummary = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED";
};

export interface InvitationRepository {
  createStudentInvitation(input: CreateInvitationRecordInput): Promise<{ id: string; expiresAt: Date }>;
  acceptStudentInvitation(input: { userId: string; tokenHash: string; acceptedAt: Date }): Promise<{ workspaceSlug: string }>;
  revokeInvitation(input: { actorId: string; invitationId: string; revokedAt: Date }): Promise<void>;
  listStudentInvitations(input: { actorId: string; workspaceSlug: string }): Promise<InvitationRecordSummary[]>;
}

export class InvitationService {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly dependencies: { now: () => Date; generateToken?: () => string } = {
      now: () => new Date(),
    },
  ) {}

  async create(input: { actorId: string; workspaceSlug: string; expiresAt: Date }) {
    const now = this.dependencies.now();
    const { rawToken, invitation } = issueInvitation({
      workspaceId: input.workspaceSlug,
      invitedById: input.actorId,
      expiresAt: input.expiresAt,
      now,
      generateToken: this.dependencies.generateToken,
    });
    const saved = await this.repository.createStudentInvitation({
      actorId: input.actorId,
      workspaceSlug: input.workspaceSlug,
      tokenHash: invitation.tokenHash,
      role: "STUDENT",
      expiresAt: input.expiresAt,
      createdAt: now,
    });
    return { id: saved.id, rawToken, expiresAt: saved.expiresAt };
  }

  accept(input: { userId: string; rawToken: string }) {
    return this.repository.acceptStudentInvitation({
      userId: input.userId,
      tokenHash: hashInvitationToken(input.rawToken),
      acceptedAt: this.dependencies.now(),
    });
  }

  revoke(input: { actorId: string; invitationId: string }) {
    return this.repository.revokeInvitation({ ...input, revokedAt: this.dependencies.now() });
  }

  async list(input: { actorId: string; workspaceSlug: string }): Promise<InvitationSummary[]> {
    const now = this.dependencies.now();
    const invitations = await this.repository.listStudentInvitations(input);
    return invitations.map(({ id, createdAt, expiresAt, acceptedAt, revokedAt }) => ({
      id, createdAt, expiresAt,
      status: acceptedAt ? "USED" : revokedAt ? "REVOKED" : expiresAt <= now ? "EXPIRED" : "ACTIVE",
    }));
  }
}
