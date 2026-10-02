"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

export type CoachStudent = { id: string; name: string; status: string };
export type CoachInvitation = {
  id: string;
  status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
};

type CreateManualStudentResult =
  { ok: true; student: { id: string; name: string; email: string } } | { ok: false; message: string };
type CreateManualStudent = (input: {
  workspaceSlug: string;
  name: string;
  email: string;
  password: string;
}) => Promise<CreateManualStudentResult>;

export function CoachStudentsView({
  workspaceSlug,
  students: initialStudents,
  createManualStudent,
}: {
  workspaceSlug: string;
  students: CoachStudent[];
  invitations?: CoachInvitation[];
  createInvitation?: unknown;
  revokeInvitation?: unknown;
  createManualStudent?: CreateManualStudent;
}) {
  const [students, setStudents] = useState(initialStudents);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setFeedback(null);
    startTransition(async () => {
      if (!createManualStudent)
        return setFeedback({ kind: "error", message: "La creación manual no está disponible." });
      const result = await createManualStudent({
        workspaceSlug,
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      if (!result.ok) return setFeedback({ kind: "error", message: result.message });
      setStudents((current) => [
        { id: result.student.id, name: result.student.name, status: "Sin plan activo" },
        ...current.filter((student) => student.id !== result.student.id),
      ]);
      form.reset();
      setFeedback({ kind: "success", message: `Alumno creado: ${result.student.email}` });
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <header className="border-b-4 border-[var(--ink)] pb-6">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Acceso del equipo</p>
        <h1 className="display-type mt-2 text-5xl font-semibold">Alumnos</h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          Creá el acceso del alumno y pasale las credenciales por WhatsApp. Sin invitaciones ni emails.
        </p>
      </header>

      {createManualStudent ? (
        <section className="mt-8 max-w-xl bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="manual-student-title">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Nuevo acceso</p>
          <h2 className="display-type mt-1 text-3xl font-semibold" id="manual-student-title">
            Crear alumno manualmente
          </h2>
          <form className="mt-5 grid gap-4" onSubmit={createStudent}>
            <TextInput label="Nombre" name="name" placeholder="Martina López" />
            <TextInput label="Email" name="email" placeholder="alumno@email.com" type="email" />
            <TextInput label="Contraseña temporal" name="password" placeholder="Mínimo 8 caracteres" type="password" />
            <button
              className="min-h-12 rounded-full bg-[var(--ink)] px-5 text-sm font-extrabold text-white disabled:opacity-50"
              disabled={pending}
            >
              {pending ? "Creando…" : "Crear alumno"}
            </button>
          </form>
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            El alumno entra directo por /sign-in con este email y contraseña temporal.
          </p>
        </section>
      ) : null}

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

      <section className="mt-9" aria-labelledby="roster-title">
        <h2 className="display-type text-3xl font-semibold" id="roster-title">
          Alumnos activos
        </h2>
        {students.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {students.map((student) => (
              <li className="border border-[var(--line)] bg-white/60 p-4" key={student.id}>
                <strong>{student.name}</strong>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{student.status}</p>
                <Link
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-4 text-sm font-extrabold text-white"
                  href={`/w/${workspaceSlug}/training?studentMembershipId=${encodeURIComponent(student.id)}#assignment`}
                >
                  Gestionar entrenamiento de {student.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border border-dashed border-[var(--line)] bg-white/50 p-5 text-sm text-[var(--ink-muted)]">
            Todavía no hay alumnos. Creá uno manualmente para asignarle un plan.
          </p>
        )}
      </section>
    </div>
  );
}

function TextInput({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--ink-muted)]">
      {label}
      <input
        className="mt-1 min-h-12 w-full border border-[var(--line)] bg-white px-3 text-base normal-case tracking-normal text-[var(--ink)]"
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
    </label>
  );
}
