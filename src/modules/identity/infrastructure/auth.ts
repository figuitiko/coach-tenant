import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/shared/infrastructure/prisma";
import { createPasswordResetMailer } from "./password-reset-mailer";

const passwordResetMailer = createPasswordResetMailer();

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
  plugins: [nextCookies()],
});
