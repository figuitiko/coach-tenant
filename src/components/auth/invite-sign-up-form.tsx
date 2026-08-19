"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/modules/identity/infrastructure/auth-client";
import { invitationTokenFromCallback } from "@/modules/identity/application/auth-callback";

type SignUpCredentials = { name: string; email: string; password: string };

export type EmailSignUp = (
  credentials: SignUpCredentials,
  invitationToken: string,
) => Promise<{ error: { message?: string } | null }>;

export function InviteSignUpForm({
  callbackUrl,
  signUp = (credentials, invitationToken) => authClient.signUp.email(credentials, {
    headers: { "x-tenand-invitation-token": invitationToken },
  }),
  navigate,
}: {
  callbackUrl: string;
  signUp?: EmailSignUp;
  navigate?: (path: string) => void;
}) {
  const invitationToken = invitationTokenFromCallback(callbackUrl);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  if (!invitationToken) return null;
  const validInvitationToken = invitationToken;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const data = new FormData(event.currentTarget);
    try {
      const result = await signUp({
        name: String(data.get("name")),
        email: String(data.get("email")),
        password: String(data.get("password")),
      }, validInvitationToken);
      if (result.error) {
        setStatus("error");
        return;
      }
      setStatus("success");
      (navigate ?? ((path: string) => window.location.assign(path)))(callbackUrl);
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="mt-8 space-y-5 border-t border-[var(--line)] pt-8" onSubmit={submit}>
      <h2 className="display-type text-3xl font-semibold">¿Sos nuevo? Creá tu cuenta.</h2>
      <label className="block text-sm font-bold" htmlFor="sign-up-name">Nombre
        <input className="mt-2 min-h-12 w-full border border-[var(--line)] bg-white/70 px-4 font-normal" id="sign-up-name" name="name" autoComplete="name" required />
      </label>
      <label className="block text-sm font-bold" htmlFor="sign-up-email">Email
        <input className="mt-2 min-h-12 w-full border border-[var(--line)] bg-white/70 px-4 font-normal" id="sign-up-email" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block text-sm font-bold" htmlFor="sign-up-password">Contraseña
        <input className="mt-2 min-h-12 w-full border border-[var(--line)] bg-white/70 px-4 font-normal" id="sign-up-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <button className="min-h-11 w-full rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70" disabled={status === "loading"} type="submit">
        {status === "loading" ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      <p aria-live="polite" className="min-h-5 text-center text-xs font-bold text-[var(--ink-muted)]">
        {status === "success" && "Cuenta creada. Volviendo a tu invitación…"}
        {status === "error" && <span role="alert">No pudimos crear la cuenta. Si ya existe, iniciá sesión.</span>}
      </p>
    </form>
  );
}
