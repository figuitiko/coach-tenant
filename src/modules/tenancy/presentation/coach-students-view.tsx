"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

export type CoachStudent = { id: string; name: string; status: string };
export type CoachInvitation = { id: string; status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED"; createdAt: string; expiresAt: string };
type CreateResult = { ok: true; invitation: { id: string; rawToken: string; expiresAt: Date } } | { ok: false; message: string };
type CreateInvitation = (input: { workspaceSlug: string; expiresAt: Date }) => Promise<CreateResult>;
type RevokeInvitation = (invitationId: string) => Promise<{ ok: true } | { ok: false; message: string }>;

export function CoachStudentsView({ workspaceSlug, students, invitations: initialInvitations, createInvitation, revokeInvitation }: { workspaceSlug: string; students: CoachStudent[]; invitations: CoachInvitation[]; createInvitation: CreateInvitation; revokeInvitation: RevokeInvitation }) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [oneTimeLink, setOneTimeLink] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const expiresAt = new Date(String(data.get("expiresAt")));
    setOneTimeLink(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await createInvitation({ workspaceSlug, expiresAt });
      if (!result.ok) return setFeedback({ kind: "error", message: result.message });
      const link = `${window.location.origin}/invite/${result.invitation.rawToken}`;
      setOneTimeLink(link);
      setInvitations((current) => [{ id: result.invitation.id, status: "ACTIVE", createdAt: new Date().toISOString(), expiresAt: result.invitation.expiresAt.toISOString() }, ...current]);
    });
  }

  function revoke(invitationId: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await revokeInvitation(invitationId);
      if (!result.ok) return setFeedback({ kind: "error", message: result.message });
      setInvitations((current) => current.map((invitation) => invitation.id === invitationId ? { ...invitation, status: "REVOKED" } : invitation));
      setFeedback({ kind: "success", message: "Invitación revocada." });
    });
  }

  async function copyLink() {
    if (!oneTimeLink) return;
    await navigator.clipboard.writeText(oneTimeLink);
    setFeedback({ kind: "success", message: "Enlace copiado." });
  }

  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
    <header className="border-b-4 border-[var(--ink)] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Acceso del equipo</p><h1 className="display-type mt-2 text-5xl font-semibold">Alumnos e invitaciones</h1><p className="mt-3 text-[var(--ink-muted)]">Invitá por enlace y conservá el control sobre cada acceso.</p></header>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="invite-title"><h2 className="display-type text-3xl font-semibold" id="invite-title">Nueva invitación</h2><form className="mt-5" onSubmit={create}><label className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--ink-muted)]">Vence<input className="mt-1 min-h-12 w-full border border-[var(--line)] bg-white px-3" name="expiresAt" required type="datetime-local" /></label><button className="mt-4 min-h-12 rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white disabled:opacity-50" disabled={pending}>{pending ? "Generando…" : "Generar invitación"}</button></form>
        {oneTimeLink ? <div aria-live="polite" className="mt-5 border-l-4 border-[var(--signal)] bg-white p-4" role="status"><p className="font-extrabold">Copiá este enlace ahora</p><p className="mt-1 break-all text-sm">{oneTimeLink}</p><p className="mt-2 text-xs text-[var(--ink-muted)]">Por seguridad, se muestra una sola vez y no vuelve a aparecer en el historial.</p><button className="mt-3 min-h-11 rounded-full border-2 border-[var(--ink)] px-4 text-sm font-bold" onClick={copyLink} type="button">Copiar enlace</button><button className="ml-2 min-h-11 px-3 text-sm font-bold underline" onClick={() => setOneTimeLink(null)} type="button">Ocultar</button></div> : null}
        {feedback ? <p aria-live="polite" className={feedback.kind === "error" ? "mt-4 text-sm font-bold text-red-700" : "mt-4 text-sm font-bold text-[var(--signal-dark)]"} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
      </section>
      <section aria-labelledby="history-title"><h2 className="display-type text-3xl font-semibold" id="history-title">Historial de invitaciones</h2>{invitations.length ? <ul className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">{invitations.map((invitation) => <li className="flex items-center justify-between gap-4 py-4" key={invitation.id}><div><strong>{statusLabel(invitation.status)}</strong><p className="text-xs text-[var(--ink-muted)]">Vence {new Date(invitation.expiresAt).toLocaleDateString("es")}</p></div>{invitation.status === "ACTIVE" ? <button className="min-h-11 text-sm font-bold text-red-700 underline" disabled={pending} onClick={() => revoke(invitation.id)} type="button">Revocar</button> : null}</li>)}</ul> : <p className="mt-4 border border-dashed border-[var(--line)] bg-white/50 p-5 text-sm text-[var(--ink-muted)]">Todavía no generaste invitaciones.</p>}</section>
    </div>
    <section className="mt-9" aria-labelledby="roster-title"><h2 className="display-type text-3xl font-semibold" id="roster-title">Alumnos</h2>{students.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{students.map((student) => <li className="border border-[var(--line)] bg-white/60 p-4" key={student.id}><strong>{student.name}</strong><p className="mt-1 text-sm text-[var(--ink-muted)]">{student.status}</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-4 text-sm font-extrabold text-white" href={`/w/${workspaceSlug}/training?studentMembershipId=${encodeURIComponent(student.id)}#assignment`}>Gestionar entrenamiento de {student.name}</Link></li>)}</ul> : <p className="mt-4 border border-dashed border-[var(--line)] bg-white/50 p-5 text-sm text-[var(--ink-muted)]">Cuando acepten una invitación, van a aparecer acá.</p>}</section>
  </div>;
}

function statusLabel(status: CoachInvitation["status"]) { return status === "ACTIVE" ? "Activa" : status === "USED" ? "Usada" : status === "REVOKED" ? "Revocada" : "Vencida"; }
