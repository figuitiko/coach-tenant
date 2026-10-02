"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

type ChangePassword = (input: {
  workspaceSlug: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => Promise<{ ok: true } | { ok: false; message: string }>;

export function ChangePasswordForm({
  workspaceSlug,
  changePassword,
}: {
  workspaceSlug: string;
  changePassword: ChangePassword;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setFeedback(null);

    startTransition(async () => {
      const result = await changePassword({
        workspaceSlug,
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      });

      if (!result.ok) return setFeedback({ kind: "error", message: result.message });
      formRef.current?.reset();
      setFeedback({ kind: "success", message: "Contraseña actualizada." });
    });
  }

  return (
    <form ref={formRef} className="mt-6 grid max-w-xl gap-4 bg-[var(--paper)] p-5 sm:p-7" onSubmit={submit}>
      <PasswordInput label="Contraseña actual" name="currentPassword" autoComplete="current-password" />
      <PasswordInput label="Nueva contraseña" name="newPassword" autoComplete="new-password" />
      <PasswordInput label="Confirmar nueva contraseña" name="confirmPassword" autoComplete="new-password" />
      <button
        className="min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-extrabold text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Actualizando…" : "Cambiar contraseña"}
      </button>
      {feedback ? (
        <p
          aria-live="polite"
          className={
            feedback.kind === "error" ? "text-sm font-bold text-red-700" : "text-sm font-bold text-[var(--signal-dark)]"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

function PasswordInput({ label, name, autoComplete }: { label: string; name: string; autoComplete: string }) {
  return (
    <label className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--ink-muted)]">
      {label}
      <input
        autoComplete={autoComplete}
        className="mt-1 min-h-12 w-full border border-[var(--line)] bg-white px-3 text-base normal-case tracking-normal text-[var(--ink)]"
        minLength={8}
        name={name}
        required
        type="password"
      />
    </label>
  );
}
