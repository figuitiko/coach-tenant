"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ReviewDetail, ReviewQueueItem } from "../application/progress-service";

export type ProgressActionState = { status: "idle" | "success" | "error"; message: string; upload?: { url: string; objectKey: string; expiresAt: string } };
type Action = (state: ProgressActionState, data: FormData) => Promise<ProgressActionState>;
const initial: ProgressActionState = { status: "idle", message: "" };
const input = "mt-1 min-h-12 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-base";
const label = "text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--ink-muted)]";

export function StudentProgressView({ draft, history, actions }: { draft: { id: string; status: string; metrics: Record<string, unknown>; notes: string | null; photos: unknown[] }; history: Array<{ id: string; submittedAt?: Date | null; notes?: string | null }>; actions: { saveDraft: Action; submit: Action; requestUpload: Action; attachPhoto: Action } }) {
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12">
    <header className="border-b-4 border-[var(--ink)] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Mediciones privadas</p><h1 className="display-type mt-2 text-5xl font-semibold">Tu progreso</h1><p className="mt-3 max-w-xl text-[var(--ink-muted)]">Registrá señales útiles, no perfección. Solo vos y tu coach pueden ver este historial.</p></header>
    <section className="mt-8 bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="checkin-title"><h2 className="display-type text-3xl font-semibold" id="checkin-title">Check-in en borrador</h2>
      <ActionForm action={actions.saveDraft} className="mt-5 grid grid-cols-2 gap-4"><input name="checkInId" type="hidden" value={draft.id}/><Metric name="weight" title="Peso" units={[["KG","kg"],["LB","lb"]]}/><Metric name="bodyFat" title="Grasa corporal" units={[["PERCENT","%"]]}/>{[["chest","Pecho"],["waist","Cintura"],["hips","Cadera"],["arm","Brazo"],["thigh","Muslo"]].map(([name,title]) => <Metric key={name} name={name} title={title} units={[["CM","cm"],["IN","in"]]}/>)}<label className={`${label} col-span-2`}>Notas<textarea className={`${input} min-h-28 py-3`} name="notes" defaultValue={draft.notes ?? ""}/></label><PendingButton>Guardar borrador</PendingButton></ActionForm>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><PrivatePhotoUploader checkInId={draft.id} requestUpload={actions.requestUpload} attachPhoto={actions.attachPhoto}/><ActionForm action={actions.submit}><input name="checkInId" type="hidden" value={draft.id}/><input name="idempotencyKey" type="hidden" value={`submit-${draft.id}`}/><PendingButton disabled={draft.status !== "DRAFT"}>Enviar check-in</PendingButton></ActionForm></div>
    </section>
    <section className="mt-8" aria-labelledby="history-title"><h2 className="display-type text-3xl font-semibold" id="history-title">Historial propio</h2>{history.length ? <ol className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">{history.map(item => <li className="py-4" key={item.id}><strong>Check-in enviado</strong><p className="text-sm text-[var(--ink-muted)]">{item.notes ?? "Sin notas"}</p></li>)}</ol> : <p className="mt-4 bg-white p-5">Tu primer check-in aparecerá acá.</p>}</section>
  </div>;
}

export function CoachReviewView({ queue, detail, reviewAction }: { queue: ReviewQueueItem[]; detail: ReviewDetail | null; reviewAction: Action }) {
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12"><header className="border-b-4 border-[var(--ink)] pb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Seguimiento contextual</p><h1 className="display-type mt-2 text-5xl font-semibold">Cola de revisión</h1></header><div className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><section><h2 className="sr-only">Pendientes</h2><ul aria-label="Pendientes" className="divide-y divide-[var(--line)] border-y border-[var(--line)]">{queue.map(item => <li className="py-4" key={`${item.kind}-${item.id}`}><Link className="font-extrabold underline underline-offset-4" href={`?kind=${item.kind}&itemId=${item.id}`}>Revisar {item.kind === "WORKOUT" ? "entrenamiento" : "check-in"} de {item.studentName}</Link></li>)}</ul></section>{detail ? <section className="bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="detail-title"><h2 className="display-type text-3xl font-semibold" id="detail-title">{detail.studentName}</h2><p className="mt-1 text-sm font-bold text-[var(--ink-muted)]">{detail.kind === "WORKOUT" ? "Entrenamiento completado" : "Check-in enviado"}</p><dl className="mt-5 grid grid-cols-2 gap-3">{detail.details.map(row => <div className="border-t border-[var(--line)] pt-2" key={row.label}><dt className="text-xs font-extrabold uppercase text-[var(--ink-muted)]">{row.label}</dt><dd className="mt-1 font-bold">{row.value}</dd></div>)}</dl>{detail.photos.length ? <ul aria-label="Fotos privadas" className="mt-4">{detail.photos.map(photo => <li key={photo.id}><Link className="font-bold text-[var(--signal-dark)] underline" href={`./progress/photos/${photo.id}`}>Abrir foto privada</Link></li>)}</ul> : null}<ActionForm action={reviewAction} className="mt-5"><input name="kind" type="hidden" value={detail.kind}/><input name="itemId" type="hidden" value={detail.id}/><input name="idempotencyKey" type="hidden" value={`review-${detail.kind}-${detail.id}`}/><label className={label}>Nota contextual<textarea className={`${input} min-h-28 py-3`} name="note"/></label><PendingButton disabled={detail.reviewStatus === "REVIEWED"}>{detail.reviewStatus === "REVIEWED" ? "Ya revisado" : "Marcar revisado"}</PendingButton></ActionForm></section> : <p className="bg-white p-6">Elegí un registro para revisar.</p>}</div></div>;
}

function Metric({ name, title, units }: { name: string; title: string; units: string[][] }) { return <fieldset className="col-span-2 grid grid-cols-[1fr_7rem] gap-3 sm:col-span-1"><legend className={label}>{title}</legend><label className="sr-only" htmlFor={`${name}-value`}>{title}</label><input className={input} id={`${name}-value`} inputMode="decimal" min="0" name={`${name}Value`} step="0.1" type="number"/><label className="sr-only" htmlFor={`${name}-unit`}>Unidad de {title}</label><select className={input} id={`${name}-unit`} name={`${name}Unit`}>{units.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></fieldset> }
function ActionForm({ action, className, children }: { action: Action; className?: string; children: ReactNode }) { const [state, formAction] = useActionState(action, initial); return <form action={formAction} className={className}>{children}<p aria-live="polite" className={state.status === "error" ? "mt-3 text-sm font-bold text-red-700" : "sr-only"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p></form> }
function PendingButton({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) { const { pending } = useFormStatus(); return <button aria-disabled={pending || disabled} className="mt-4 min-h-12 w-full rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white disabled:opacity-50" disabled={pending || disabled}>{pending ? "Guardando…" : children}</button> }

function PrivatePhotoUploader({ checkInId, requestUpload, attachPhoto }: { checkInId: string; requestUpload: Action; attachPhoto: Action }) {
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  function upload() {
    const selected = file.current?.files?.[0];
    if (!selected) return;
    startTransition(async () => {
      try {
        const request = new FormData(); request.set("checkInId", checkInId); request.set("fileName", selected.name); request.set("mimeType", selected.type); request.set("sizeBytes", String(selected.size));
        const intent = await requestUpload(initial, request);
        if (!intent.upload) throw new Error(intent.message);
        const response = await fetch(intent.upload.url, { method: "PUT", headers: { "Content-Type": selected.type }, body: selected });
        if (!response.ok) throw new Error("upload failed");
        const metadata = new FormData(); metadata.set("checkInId", checkInId); metadata.set("objectKey", intent.upload.objectKey); metadata.set("mimeType", selected.type); metadata.set("sizeBytes", String(selected.size)); metadata.set("idempotencyKey", `photo-${intent.upload.objectKey}`);
        const attached = await attachPhoto(initial, metadata); setIsError(attached.status === "error"); setMessage(attached.message);
      } catch { setIsError(true); setMessage("No pudimos completar la subida privada."); }
    });
  }
  return <div><label className={label}>Foto privada<input ref={file} accept="image/jpeg,image/png,image/webp" className={input} required type="file"/></label><button aria-disabled={pending} className="mt-4 min-h-12 w-full rounded-full border-2 border-[var(--ink)] px-5 text-sm font-extrabold disabled:opacity-50" disabled={pending} onClick={upload} type="button">{pending ? "Subiendo…" : "Subir foto privada"}</button><p aria-live="polite" className={isError ? "mt-3 text-sm font-bold text-red-700" : "sr-only"} role={isError ? "alert" : "status"}>{message}</p></div>;
}
