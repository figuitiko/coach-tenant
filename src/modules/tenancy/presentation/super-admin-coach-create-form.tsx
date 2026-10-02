"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

type CreateManualCoach = (input: {
  coachName: string;
  email: string;
  password: string;
  workspaceName: string;
  timeZone?: string;
}) => Promise<
  | { ok: true; coach: { id: string; name: string; email: string; workspaceSlug: string; workspaceName: string } }
  | { ok: false; message: string }
>;

export function SuperAdminCoachCreateForm({ createManualCoach }: { createManualCoach: CreateManualCoach }) {
  const [createdWorkspace, setCreatedWorkspace] = useState<{ slug: string; name: string } | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setCreatedWorkspace(null);
    setFeedback(null);

    startTransition(async () => {
      const result = await createManualCoach({
        workspaceName: String(data.get("workspaceName") ?? ""),
        coachName: String(data.get("coachName") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        timeZone: String(data.get("timeZone") ?? "") || undefined,
      });
      if (!result.ok) return setFeedback({ kind: "error", message: result.message });
      form.reset();
      setCreatedWorkspace({ slug: result.coach.workspaceSlug, name: result.coach.workspaceName });
      setFeedback({
        kind: "success",
        message: `Coach creado: ${result.coach.email}. Workspace nuevo: ${result.coach.workspaceName}`,
      });
    });
  }

  return (
    <section
      className="mt-10 border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-7"
      aria-labelledby="create-coach-title"
    >
      <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Super admin</p>
      <h2 className="display-type mt-1 text-3xl font-semibold" id="create-coach-title">
        Crear coach + workspace
      </h2>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        Cada coach tiene su propio workspace. Esto crea la cuenta del coach, su workspace y el rol COACH en una sola
        operación.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <TextInput label="Nombre del workspace" name="workspaceName" placeholder="Fuerza Norte" />
        <TextInput label="Nombre del coach" name="coachName" placeholder="Nombre del coach" />
        <TextInput label="Email" name="email" placeholder="coach@email.com" type="email" />
        <TextInput label="Contraseña temporal" name="password" placeholder="Mínimo 8 caracteres" type="password" />
        <TextInput label="Zona horaria" name="timeZone" placeholder="America/Mexico_City" required={false} />
        <button
          className="min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-extrabold text-white disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "Creando…" : "Crear coach y workspace"}
        </button>
      </form>
      {feedback ? (
        <p
          aria-live="polite"
          className={
            feedback.kind === "error"
              ? "mt-4 text-sm font-bold text-red-700"
              : "mt-4 text-sm font-bold text-[var(--signal-dark)]"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
      {createdWorkspace ? (
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white"
          href={`/w/${createdWorkspace.slug}`}
        >
          Abrir {createdWorkspace.name}
        </Link>
      ) : null}
    </section>
  );
}

function TextInput({
  label,
  name,
  placeholder,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--ink-muted)]">
      {label}
      <input
        className="mt-1 min-h-12 w-full border border-[var(--line)] bg-white px-3 text-base normal-case tracking-normal text-[var(--ink)]"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}
