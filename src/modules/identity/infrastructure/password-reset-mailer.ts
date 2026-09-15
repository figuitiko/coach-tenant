import nodemailer from "nodemailer";

export type PasswordResetMessage = { to: string; resetUrl: string };

export interface PasswordResetMailer {
  sendPasswordReset(message: PasswordResetMessage): Promise<void>;
}

type MailEnvironment = Record<string, string | undefined>;

export function createPasswordResetMailer(
  environment: MailEnvironment = process.env,
  nodeEnvironment = process.env.NODE_ENV,
  developmentLog: (message: string) => void = console.info,
): PasswordResetMailer {
  const configured = environment.SMTP_HOST && environment.SMTP_PORT && environment.SMTP_FROM;
  if (!configured) {
    if (nodeEnvironment === "production") {
      throw new Error("SMTP configuration is required for password reset email in production");
    }
    return {
      async sendPasswordReset({ to, resetUrl }) {
        developmentLog(`[development password reset] ${to}: ${resetUrl}`);
      },
    };
  }

  const transport = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: Number(environment.SMTP_PORT),
    secure: Number(environment.SMTP_PORT) === 465,
    auth: environment.SMTP_USER ? { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD } : undefined,
  });
  return {
    async sendPasswordReset({ to, resetUrl }) {
      await transport.sendMail({
        from: environment.SMTP_FROM,
        to,
        subject: "Restablecé tu contraseña de CoachFlow",
        text: `Abrí este enlace para elegir una nueva contraseña: ${resetUrl}`,
      });
    },
  };
}
