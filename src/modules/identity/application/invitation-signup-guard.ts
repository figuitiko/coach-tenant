import { hashInvitationToken } from "@/modules/tenancy/domain/invitation";

export interface InvitationSignupRepository {
  isAvailable(input: { tokenHash: string; now: Date }): Promise<boolean>;
}

export class InvitationSignupDeniedError extends Error {
  constructor() {
    super("Invitation-backed account creation is unavailable");
    this.name = "InvitationSignupDeniedError";
  }
}

export async function requireAvailableInvitationForSignup(
  rawToken: string | null,
  repository: InvitationSignupRepository,
  now = new Date(),
) {
  if (!rawToken) throw new InvitationSignupDeniedError();
  const available = await repository.isAvailable({
    tokenHash: hashInvitationToken(rawToken),
    now,
  });
  if (!available) throw new InvitationSignupDeniedError();
}
