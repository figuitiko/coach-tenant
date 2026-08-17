"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/modules/identity/infrastructure/auth-client";

export type EmailSignIn = (credentials: { email: string; password: string }) => Promise<{
  error: { message?: string } | null;
}>;

export function SignInForm({
  signIn = (credentials) => authClient.signIn.email(credentials),
  navigate,
}: {
  signIn?: EmailSignIn;
  navigate?: (path: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const data = new FormData(event.currentTarget);
    try {
      const result = await signIn({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
      if (result.error) {
        setStatus("error");
        return;
      }
      setStatus("success");
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackURL");
      const nextPath = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
        ? callbackUrl
        : "/workspace";
      (navigate ?? ((path: string) => window.location.assign(path)))(nextPath);
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block text-sm font-bold" htmlFor="email">
        Email
        <input className="mt-2 min-h-12 w-full border border-[var(--line)] bg-white/70 px-4 font-normal focus:border-[var(--signal)] focus:outline-none" id="email" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block text-sm font-bold" htmlFor="password">
        Contraseña
        <input className="mt-2 min-h-12 w-full border border-[var(--line)] bg-white/70 px-4 font-normal focus:border-[var(--signal)] focus:outline-none" id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="min-h-11 w-full rounded-full bg-[var(--signal)] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70" disabled={status === "loading"} type="submit">
        {status === "loading" ? "Ingresando…" : "Ingresar al workspace"}
      </button>
      <p aria-live="polite" className="min-h-5 text-center text-xs font-bold text-[var(--ink-muted)]">
        {status === "success" && "Acceso confirmado."}
        {status === "error" && <span role="alert">No pudimos iniciar sesión. Revisá tus credenciales.</span>}
      </p>
    </form>
  );
}
