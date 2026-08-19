import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/shared/infrastructure/prisma";
import { createPasswordResetMailer } from "./password-reset-mailer";
import { requireAvailableInvitationForSignup } from "@/modules/identity/application/invitation-signup-guard";
import { PrismaInvitationSignupRepository } from "./prisma-invitation-signup-repository";

const passwordResetMailer = createPasswordResetMailer();
const invitationSignupRepository = new PrismaInvitationSignupRepository(prisma);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      await passwordResetMailer.sendPasswordReset({ to: user.email, resetUrl: url });
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7 },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") return;
      try {
        await requireAvailableInvitationForSignup(
          context.headers?.get("x-tenand-invitation-token") ?? null,
          invitationSignupRepository,
        );
      } catch {
        throw new APIError("BAD_REQUEST", {
          message: "Account creation is unavailable.",
        });
      }
    }),
  },
  plugins: [nextCookies()],
});
