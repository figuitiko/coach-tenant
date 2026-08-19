import type { PrismaClient } from "@/generated/prisma/client";
import type { InvitationSignupRepository } from "@/modules/identity/application/invitation-signup-guard";

export class PrismaInvitationSignupRepository implements InvitationSignupRepository {
  constructor(private readonly database: PrismaClient) {}

  async isAvailable(input: { tokenHash: string; now: Date }) {
    const invitation = await this.database.invitation.findFirst({
      where: {
        tokenHash: input.tokenHash,
        role: "STUDENT",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: input.now },
      },
      select: { id: true },
    });
    return invitation !== null;
  }
}
