"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ReviewDetail, ReviewHistoryItem, ReviewQueueItem } from "../application/progress-service";

export type ProgressActionState = { status: "idle" | "success" | "error"; message: string; upload?: { url: string; headers: Record<string, string>; intentId: string; expiresAt: string } };
type Action = (state: ProgressActionState, data: FormData) => Promise<ProgressActionState>;
const initial: ProgressActionState = { status: "idle", message: "" };
const input = "mt-1 min-h-12 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-base";
const label = "text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--ink-muted)]";

export function StudentProgressView({ draft, history, actions }: { draft: { id: string; status: string; metrics: Record<string, unknown>; notes: string | null; photos: unknown[] }; history: Array<{ id: string; submittedAt?: Date | null; notes?: string | null; reviewNotes?: ReviewDetail["notes"] }>; actions: { saveOrSubmit: Action; reply: Action; requestUpload: Action; attachPhoto: Action } }) {
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12">
    <header className="border-b-4 border-[var(--ink)] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Mediciones privadas</p><h1 className="display-type mt-2 text-5xl font-semibold">Tu progreso</h1><p className="mt-3 max-w-xl text-[var(--ink-muted)]">Registrá señales útiles, no perfección. Solo vos y tu coach pueden ver este historial.</p></header>
    <section className="mt-8 bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="checkin-title"><h2 className="display-type text-3xl font-semibold" id="checkin-title">Check-in en borrador</h2>
      <ActionForm action={actions.saveOrSubmit} className="mt-5 grid grid-cols-2 gap-4"><input name="checkInId" type="hidden" value={draft.id}/><input name="idempotencyKey" type="hidden" value={`submit-${draft.id}`}/><Metric current={metricFrom(draft.metrics.weight)} name="weight" title="Peso" units={[["KG","kg"],["LB","lb"]]}/><Metric current={metricFrom(draft.metrics.bodyFat)} name="bodyFat" title="Grasa corporal" units={[["PERCENT","%"]]}/>{[["chest","Pecho"],["waist","Cintura"],["hips","Cadera"],["arm","Brazo"],["thigh","Muslo"]].map(([name,title]) => <Metric current={metricFrom(draft.metrics[name])} key={name} name={name} title={title} units={[["CM","cm"],["IN","in"]]}/>)}<label className={`${label} col-span-2`}>Notas<textarea className={`${input} min-h-28 py-3`} name="notes" defaultValue={draft.notes ?? ""}/></label><div className="col-span-2 grid gap-3 sm:grid-cols-2"><PendingButton name="intent" value="SAVE">Guardar borrador</PendingButton><PendingButton disabled={draft.status !== "DRAFT"} name="intent" value="SUBMIT">Enviar check-in</PendingButton></div></ActionForm>
      <div className="mt-5"><PrivatePhotoUploader checkInId={draft.id} requestUpload={actions.requestUpload} attachPhoto={actions.attachPhoto}/></div>
    </section>
    <section className="mt-8" aria-labelledby="history-title"><h2 className="display-type text-3xl font-semibold" id="history-title">Historial propio</h2>{history.length ? <ol className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">{history.map(item => <li className="py-4" key={item.id}><strong>Check-in enviado</strong><p className="text-sm text-[var(--ink-muted)]">{item.notes ?? "Sin notas"}</p>{item.reviewNotes?.map(note => <article className="mt-3 border-l-4 border-[var(--signal)] bg-white p-4" id={`review-${note.id}`} key={note.id}><h3 className="font-extrabold">Devolución del coach</h3><p className="mt-1">{note.body}</p>{note.reply ? <p className="mt-2 text-sm text-[var(--ink-muted)]">Tu respuesta: {note.reply.body}</p> : <ActionForm action={actions.reply} ariaLabel="Responder a la devolución" className="mt-3"><input name="reviewNoteId" type="hidden" value={note.id}/><label className={label}>Respuesta breve<textarea className={`${input} min-h-20 py-3`} maxLength={500} name="body" required/></label><PendingButton>Enviar respuesta</PendingButton></ActionForm>}</article>)}</li>)}</ol> : <p className="mt-4 bg-white p-5">Tu primer check-in aparecerá acá.</p>}</section>
  </div>;
}

export function CoachReviewView({ queue, history, detail, reviewAction }: { queue: ReviewQueueItem[]; history: ReviewHistoryItem[]; detail: ReviewDetail | null; reviewAction: Action }) {
  if (!queue.length && !history.length && !detail) return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><ReviewHeader/><section className="mt-8 border border-dashed border-[var(--line)] bg-white/60 p-7"><h2 className="display-type text-3xl font-semibold">Todo revisado</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Cuando un alumno complete una sesión o envíe un check-in, va a aparecer acá.</p></section></div>;
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
    <ReviewHeader/>
    <ReviewHistory history={history}/>
    <div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <section><h2 className="display-type text-2xl font-semibold">Pendientes</h2>{queue.length ? <ul aria-label="Pendientes" className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">{queue.map(item => <li className="py-4" key={`${item.kind}-${item.id}`}><Link className="font-extrabold underline underline-offset-4" href={`?kind=${item.kind}&itemId=${item.id}`}>Revisar {item.kind === "WORKOUT" ? "entrenamiento" : "check-in"} de {item.studentName}</Link></li>)}</ul> : <p className="mt-2 text-sm text-[var(--ink-muted)]">No quedan pendientes.</p>}</section>
      {detail ? <section className="bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="detail-title"><h2 className="display-type text-3xl font-semibold" id="detail-title">{detail.studentName}</h2><p className="mt-1 text-sm font-bold text-[var(--ink-muted)]">{detail.kind === "WORKOUT" ? "Entrenamiento completado" : "Check-in enviado"}</p><dl className="mt-5 grid grid-cols-2 gap-3">{detail.details.map(row => <div className="border-t border-[var(--line)] pt-2" key={row.label}><dt className="text-xs font-extrabold uppercase text-[var(--ink-muted)]">{row.label}</dt><dd className="mt-1 font-bold">{row.value}</dd></div>)}</dl>{detail.photos.length ? <ul aria-label="Fotos privadas" className="mt-4">{detail.photos.map(photo => <li key={photo.id}><Link className="font-bold text-[var(--signal-dark)] underline" href={`./progress/photos/${photo.id}`}>Abrir foto privada</Link></li>)}</ul> : null}{detail.notes.map(note => <article className="mt-4 border-l-4 border-[var(--signal)] bg-white p-4" key={note.id}><p className="font-bold">{note.body}</p>{note.reply ? <p className="mt-2 text-sm text-[var(--ink-muted)]">Respuesta del alumno: {note.reply.body}</p> : <p className="mt-2 text-sm text-[var(--ink-muted)]">Sin respuesta todavía.</p>}</article>)}<ActionForm action={reviewAction} className="mt-5"><input name="kind" type="hidden" value={detail.kind}/><input name="itemId" type="hidden" value={detail.id}/><input name="idempotencyKey" type="hidden" value={`review-${detail.kind}-${detail.id}`}/><label className={label}>Nota contextual<textarea className={`${input} min-h-28 py-3`} name="note"/></label><PendingButton disabled={detail.reviewStatus === "REVIEWED"}>{detail.reviewStatus === "REVIEWED" ? "Ya revisado" : "Marcar revisado"}</PendingButton></ActionForm></section> : <p className="bg-white p-6">Elegí un registro para revisar.</p>}
    </div>
  </div>;
}

function ReviewHeader() { return <header className="border-b-4 border-[var(--ink)] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Seguimiento contextual</p><h1 className="display-type mt-2 text-5xl font-semibold">Cola de revisión</h1></header>; }

function ReviewHistory({ history }: { history: ReviewHistoryItem[] }) {
  const replied = history.filter(item => item.reply);
  const recent = history.filter(item => !item.reply);
  return <div className="mt-8 grid gap-5 lg:grid-cols-2">
    <section aria-labelledby="student-replies-title" className="border-t-4 border-[var(--signal)] bg-white p-5"><h2 className="display-type text-3xl font-semibold" id="student-replies-title">Respuestas de alumnos</h2>{replied.length ? <ul className="mt-3 divide-y divide-[var(--line)]">{replied.map(item => <li className="py-3" key={`${item.kind}-${item.id}`}><strong>{item.studentName}</strong><p className="mt-1 text-xs font-bold text-[var(--ink-muted)]">Revisado el <time dateTime={item.reviewedAt.toISOString()}>{shortDate(item.reviewedAt)}</time> · Respondió el <time dateTime={item.reply!.createdAt.toISOString()}>{shortDate(item.reply!.createdAt)}</time></p><p className="line-clamp-2 text-sm text-[var(--ink-muted)]">{item.reply!.body}</p><Link className="mt-2 inline-block text-sm font-extrabold underline underline-offset-4" href={`?kind=${item.kind}&itemId=${item.id}`}>Ver respuesta de {item.studentName}</Link></li>)}</ul> : <p className="mt-3 text-sm text-[var(--ink-muted)]">Las respuestas breves van a aparecer acá.</p>}</section>
    <section aria-labelledby="recent-reviews-title" className="bg-[var(--paper)] p-5"><h2 className="display-type text-3xl font-semibold" id="recent-reviews-title">Revisados recientemente</h2>{recent.length ? <ul className="mt-3 divide-y divide-[var(--line)]">{recent.map(item => <li className="py-3" key={`${item.kind}-${item.id}`}><strong>{item.studentName}</strong><p className="mt-1 text-xs font-bold text-[var(--ink-muted)]">Revisado el <time dateTime={item.reviewedAt.toISOString()}>{shortDate(item.reviewedAt)}</time></p><p className="text-sm text-[var(--ink-muted)]">{item.kind === "WORKOUT" ? "Entrenamiento" : "Check-in"} · Sin respuesta todavía</p><Link className="mt-2 inline-block text-sm font-extrabold underline underline-offset-4" href={`?kind=${item.kind}&itemId=${item.id}`}>Ver revisión de {item.studentName}</Link></li>)}</ul> : <p className="mt-3 text-sm text-[var(--ink-muted)]">No hay revisiones recientes sin respuesta.</p>}</section>
  </div>;
}

function shortDate(value: Date) { return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(value); }

function Metric({ name, title, units, current }: { name: string; title: string; units: string[][]; current: { value: number; unit: string } | null }) { return <fieldset className="col-span-2 grid grid-cols-[1fr_7rem] gap-3 sm:col-span-1"><legend className={label}>{title}</legend><label className="sr-only" htmlFor={`${name}-value`}>{title}</label><input className={input} defaultValue={current?.value} id={`${name}-value`} inputMode="decimal" min="0" name={`${name}Value`} step="0.1" type="number"/><label className="sr-only" htmlFor={`${name}-unit`}>Unidad de {title}</label><select className={input} defaultValue={current?.unit ?? units[0][0]} id={`${name}-unit`} name={`${name}Unit`}>{units.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></fieldset> }
function metricFrom(value: unknown) { if (!value || typeof value !== "object" || !("value" in value) || !("unit" in value) || typeof value.value !== "number" || typeof value.unit !== "string") return null; return { value: value.value, unit: value.unit }; }
function ActionForm({ action, ariaLabel, className, children }: { action: Action; ariaLabel?: string; className?: string; children: ReactNode }) { const [state, formAction] = useActionState(action, initial); return <form action={formAction} aria-label={ariaLabel} className={className}>{children}<p aria-live="polite" className={state.status === "idle" ? "sr-only" : state.status === "error" ? "mt-3 text-sm font-bold text-red-700" : "mt-3 text-sm font-bold text-[var(--signal-dark)]"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p></form> }
function PendingButton({ children, disabled = false, name, value }: { children: ReactNode; disabled?: boolean; name?: string; value?: string }) { const { pending } = useFormStatus(); return <button aria-disabled={pending || disabled} className="mt-4 min-h-12 w-full rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white disabled:opacity-50" disabled={pending || disabled} name={name} value={value}>{pending ? "Guardando…" : children}</button> }

export function PrivatePhotoUploader({ checkInId, requestUpload, attachPhoto }: { checkInId: string; requestUpload: Action; attachPhoto: Action }) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [pending, startTransition] = useTransition();
  function upload() {
    const selected = file.current?.files?.[0];
    if (!selected) return;
    startTransition(async () => {
      try {
        const checksumSha256 = await sha256Base64(selected);
        const fingerprint = `${selected.name}:${selected.type}:${selected.size}:${selected.lastModified}:${checksumSha256}`;
        if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
        const request = new FormData(); request.set("checkInId", checkInId); request.set("fileName", selected.name); request.set("mimeType", selected.type); request.set("sizeBytes", String(selected.size)); request.set("checksumSha256", checksumSha256); request.set("idempotencyKey", attempt.current.key);
        const intent = await requestUpload(initial, request);
        if (!intent.upload) throw new Error(intent.message);
        const response = await fetch(intent.upload.url, { method: "PUT", headers: intent.upload.headers, body: selected });
        if (!response.ok) throw new Error("upload failed");
        const metadata = new FormData(); metadata.set("uploadIntentId", intent.upload.intentId);
        const attached = await attachPhoto(initial, metadata); setIsError(attached.status === "error"); setMessage(attached.message); if (attached.status === "success") attempt.current = null;
      } catch { setIsError(true); setMessage("No pudimos completar la subida privada."); }
    });
  }
  return <div><label className={label}>Foto privada<input ref={file} accept="image/jpeg,image/png,image/webp" className={input} required type="file"/></label><button aria-disabled={pending} className="mt-4 min-h-12 w-full rounded-full border-2 border-[var(--ink)] px-5 text-sm font-extrabold disabled:opacity-50" disabled={pending} onClick={upload} type="button">{pending ? "Subiendo…" : "Subir foto privada"}</button><p aria-live="polite" className={!message ? "sr-only" : isError ? "mt-3 text-sm font-bold text-red-700" : "mt-3 text-sm font-bold text-[var(--signal-dark)]"} role={isError ? "alert" : "status"}>{message}</p></div>;
}
async function sha256Base64(file: File) { const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return btoa(String.fromCharCode(...new Uint8Array(digest))); }
