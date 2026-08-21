"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { initialTrainingActionState, type TrainingActionState } from "./training-action-state";
import type { AssignedWorkout, CoachTrainingDashboard } from "../application/training-service";

type FormAction = (previousState: TrainingActionState, formData: FormData) => Promise<TrainingActionState>;

const fieldClass = "mt-1 min-h-12 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-base";
const labelClass = "text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--ink-muted)]";
const buttonClass = "min-h-12 rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white disabled:opacity-50";

export function CoachTrainingView({
  dashboard,
  selectedStudentMembershipId,
  actions,
}: {
  dashboard: CoachTrainingDashboard;
  selectedStudentMembershipId?: string;
  actions: { createExercise: FormAction; createTemplate: FormAction; editTemplate: FormAction; createPlan: FormAction; assignPlan: FormAction };
}) {
  const selectedStudent = dashboard.students.find((student) => student.membershipId === selectedStudentMembershipId);
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <header className="border-b-4 border-[var(--ink)] pb-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal-dark)]">Programación</p>
        <h1 className="display-type mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">Entrenamiento</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">Armá la biblioteca una vez, programá fechas concretas y asigná el bloque al alumno correcto.</p>
      </header>

      <section className="mt-9 grid gap-5 lg:grid-cols-2" aria-labelledby="exercise-library-title">
        <article className="bg-[var(--paper)] p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Paso 1</p>
          <h2 className="display-type text-3xl font-semibold" id="exercise-library-title">Biblioteca de ejercicios</h2>
          <ActionForm action={actions.createExercise} ariaLabel="Crear ejercicio" className="mt-5 grid gap-4">
            <label className={labelClass}>Nombre<input className={fieldClass} name="name" required /></label>
            <label className={labelClass}>Notas técnicas<textarea className={`${fieldClass} min-h-24 py-3`} name="notes" /></label>
            <SubmitButton className={buttonClass}>Guardar ejercicio</SubmitButton>
          </ActionForm>
          {dashboard.exercises.length ? <ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {dashboard.exercises.map((exercise) => <li className="py-3 font-bold" key={exercise.id}>{exercise.name}</li>)}
          </ul> : <p className="mt-6 border border-dashed border-[var(--line)] bg-white/50 p-4 text-sm text-[var(--ink-muted)]">Tu biblioteca está vacía. Guardá el primer ejercicio para empezar una plantilla.</p>}
        </article>

        <article className="border border-[var(--line)] bg-white/60 p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Paso 2</p>
          <h2 className="display-type text-3xl font-semibold">Plantilla práctica</h2>
          <ActionForm action={actions.createTemplate} ariaLabel="Crear plantilla" className="mt-5 grid grid-cols-2 gap-4">
            <label className={`${labelClass} col-span-2`}>Nombre de plantilla<input className={fieldClass} name="name" required /></label>
            <label className={`${labelClass} col-span-2`}>Descripción<textarea className={`${fieldClass} min-h-20 py-3`} name="description" /></label>
            <input name="exerciseCount" type="hidden" value="3" />
            {[0, 1, 2].map((index) => <PrescriptionFields exercises={dashboard.exercises} includeLabel={`Incluir ejercicio ${index + 1}`} index={index} key={index} />)}
            <SubmitButton className={`${buttonClass} col-span-2`}>Crear plantilla</SubmitButton>
          </ActionForm>
        </article>
      </section>

      {dashboard.templates.length ? (
        <section className="mt-5 border-t-4 border-[var(--ink)] bg-[var(--paper)] p-5 sm:p-7" aria-labelledby="edit-template-title">
          <h2 className="display-type text-3xl font-semibold" id="edit-template-title">Editar plantillas</h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Los cambios aplican a próximas asignaciones; lo ya asignado conserva su receta original.</p>
          <div className="mt-5 grid gap-4">
            {dashboard.templates.map((template) => (
              <details className="border border-[var(--line)] bg-white p-4" key={template.id} open>
                <summary className="cursor-pointer font-extrabold">{template.name}</summary>
                <ActionForm action={actions.editTemplate} ariaLabel={`Editar plantilla ${template.name}`} className="mt-5 grid grid-cols-2 gap-4">
                  <input name="templateId" type="hidden" value={template.id} />
                  <input name="exerciseCount" type="hidden" value={template.exercises.length + 1} />
                  <label className={`${labelClass} col-span-2`}>Nombre<input className={fieldClass} defaultValue={template.name} name="name" required /></label>
                  <label className={`${labelClass} col-span-2`}>Descripción<textarea className={`${fieldClass} min-h-20 py-3`} defaultValue={template.description ?? ""} name="description" /></label>
                  {template.exercises.map((exercise, index) => (
                    <PrescriptionFields defaultValue={exercise} exercises={dashboard.exercises} includeLabel={`Mantener ejercicio ${index + 1}`} index={index} key={`${exercise.exerciseId}-${index}`} />
                  ))}
                  <PrescriptionFields exercises={dashboard.exercises} includeLabel="Agregar ejercicio" index={template.exercises.length} />
                  <SubmitButton className={`${buttonClass} col-span-2`}>Guardar cambios</SubmitButton>
                </ActionForm>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" aria-label="Planificación">
        <article className="border-t-4 border-[var(--signal)] bg-[var(--ink)] p-5 text-white sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-bright)]">Paso 3</p>
          <h2 className="display-type text-3xl font-semibold">Calendario del plan</h2>
          <ActionForm action={actions.createPlan} ariaLabel="Programar plan" className="mt-5 grid grid-cols-2 gap-4">
            <label className={`${labelClass} col-span-2 !text-white/75`}>Nombre del bloque<input className={`${fieldClass} text-[var(--ink)]`} name="name" required /></label>
            <label className={`${labelClass} !text-white/75`}>Inicio<input className={`${fieldClass} text-[var(--ink)]`} name="startsOn" required type="date" /></label>
            <label className={`${labelClass} !text-white/75`}>Fin<input className={`${fieldClass} text-[var(--ink)]`} name="endsOn" required type="date" /></label>
            <input name="workoutCount" type="hidden" value="3" />
            {[0, 1, 2].map((index) => (
              <fieldset className="col-span-2 grid grid-cols-2 gap-3 border-t border-white/20 pt-3" key={index}>
                <legend className="px-2 text-sm font-extrabold">Entrenamiento {index + 1}</legend>
                <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm font-bold"><input defaultChecked={index === 0} name={`includeWorkout-${index}`} type="checkbox" value="true" />Incluir entrenamiento {index + 1}</label>
                <label className={`${labelClass} col-span-2 !text-white/75`}>Plantilla<select className={`${fieldClass} text-[var(--ink)]`} name={`templateId-${index}`}><option value="">Elegí una</option>{dashboard.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
                <label className={`${labelClass} col-span-2 !text-white/75`}>Fecha<input className={`${fieldClass} text-[var(--ink)]`} name={`scheduledOn-${index}`} type="date" /></label>
              </fieldset>
            ))}
            <SubmitButton className={`${buttonClass} col-span-2 bg-[var(--signal-bright)] text-[var(--ink)]`}>Programar plan</SubmitButton>
          </ActionForm>
        </article>
        <article className="bg-[var(--paper)] p-5 sm:p-7" id="assignment">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Paso 4</p>
          <h2 className="display-type text-3xl font-semibold">Asignación</h2>
          {selectedStudent ? <p className="mt-2 rounded-lg bg-white p-3 text-sm font-extrabold">Asignando a {selectedStudent.name}</p> : <p className="mt-2 text-sm text-[var(--ink-muted)]">Elegí un alumno de este workspace.</p>}
          <ActionForm action={actions.assignPlan} ariaLabel="Asignar plan" className="mt-5 grid gap-4">
            <label className={labelClass}>Plan<select className={fieldClass} name="planId" required><option value="">Elegí uno</option>{dashboard.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
            <label className={labelClass}>Alumno<select className={fieldClass} defaultValue={selectedStudentMembershipId ?? ""} name="studentMembershipId" required><option value="">Elegí uno</option>{dashboard.students.map((student) => <option key={student.membershipId} value={student.membershipId}>{student.name}</option>)}</select></label>
            <SubmitButton className={buttonClass}>Asignar plan</SubmitButton>
          </ActionForm>
        </article>
      </section>
    </div>
  );
}

export function StudentTrainingView({
  date,
  workouts,
  overview = workouts,
  actions,
}: {
  date: string;
  workouts: AssignedWorkout[];
  overview?: AssignedWorkout[];
  actions: { saveSet: FormAction; completeWorkout: FormAction; replyToReview: FormAction };
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-8 lg:py-12">
      <header className="border-b-4 border-[var(--ink)] pb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal-dark)]">Tu agenda · {date}</p>
        <h1 className="display-type mt-2 text-5xl font-semibold">Entrenamiento de hoy</h1>
      </header>
      <section className="mt-7 bg-[var(--paper)] p-5" aria-labelledby="plan-overview-title">
        <h2 className="display-type text-3xl font-semibold" id="plan-overview-title">Tu plan asignado</h2>
        {overview.length ? <ul className="mt-4 grid gap-3">{overview.map((workout) => <li className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3" key={workout.id}><div><strong>{workout.templateName}</strong><p className="text-sm text-[var(--ink-muted)]">{workout.scheduledOn} · {statusLabel(workout.status)}</p></div><Link className="min-h-11 rounded-full border-2 border-[var(--ink)] px-4 py-2 text-sm font-extrabold" href={`?date=${workout.scheduledOn}#workout-${workout.id}`}>Abrir {workout.templateName}</Link></li>)}</ul> : <p className="mt-3 text-sm text-[var(--ink-muted)]">Todavía no tenés un plan asignado. Tu coach lo va a preparar con fechas concretas.</p>}
      </section>
      <nav aria-label="Cambiar fecha de entrenamiento" className="mt-5 grid grid-cols-3 items-center gap-2"><Link className="min-h-11 rounded-full border border-[var(--line)] px-3 py-2 text-center text-sm font-bold" href={`?date=${shiftDate(date, -1)}`}>Día anterior</Link><span className="text-center text-sm font-extrabold">{date}</span><Link className="min-h-11 rounded-full border border-[var(--line)] px-3 py-2 text-center text-sm font-bold" href={`?date=${shiftDate(date, 1)}`}>Día siguiente</Link></nav>
      {workouts.length === 0 ? <p className="mt-8 bg-[var(--paper)] p-6 font-bold">No tenés una sesión programada para hoy.</p> : workouts.map((workout) => (
        <article className="mt-7" id={`workout-${workout.id}`} key={workout.id}>
          <div className="flex items-end justify-between gap-4 bg-[var(--ink)] p-5 text-white">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">{statusLabel(workout.status)}</p><h2 className="display-type mt-1 text-4xl font-semibold">{workout.templateName}</h2></div>
            <span className="text-sm font-bold">{workout.exercises.length} ejercicios</span>
          </div>
          <div className="divide-y divide-[var(--line)] border-x border-b border-[var(--line)] bg-[var(--paper-light)]">
            {workout.exercises.map((exercise) => (
              <section className="p-4 sm:p-6" key={exercise.id} aria-labelledby={`${exercise.id}-title`}>
                <h3 className="display-type text-3xl font-semibold" id={`${exercise.id}-title`}>{exercise.exerciseName}</h3>
                <p className="mt-1 text-sm font-bold text-[var(--ink-muted)]">{exercise.prescribedSets} × {exercise.repMin}–{exercise.repMax} · RPE {exercise.targetRpe ?? "libre"} · {exercise.restSeconds ?? 0}s</p>
                {exercise.notes ? <p className="mt-3 border-l-4 border-[var(--signal)] pl-3 text-sm">{exercise.notes}</p> : null}
                <div className="mt-5 grid gap-4">
                  {Array.from({ length: exercise.prescribedSets }, (_, index) => {
                    const setNumber = index + 1;
                    const logged = workout.session?.sets.find((set) => set.exerciseSnapshotId === exercise.id && set.setNumber === setNumber);
                    return (
                      <ActionForm action={actions.saveSet} ariaLabel={`Registrar serie ${setNumber} de ${exercise.exerciseName}`} className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--line)] bg-white p-4 sm:grid-cols-4" key={setNumber}>
                        <input name="assignedWorkoutId" type="hidden" value={workout.id} />
                        <input name="exerciseSnapshotId" type="hidden" value={exercise.id} />
                        <input name="setNumber" type="hidden" value={setNumber} />
                        <p className="col-span-2 text-xs font-extrabold uppercase tracking-[0.12em] sm:col-span-4">Serie {setNumber}{logged ? " · guardada" : ""}</p>
                        <label className={labelClass}>Repeticiones reales<input className={fieldClass} defaultValue={logged?.reps} inputMode="numeric" min="0" name="reps" required type="number" /></label>
                        <label className={labelClass}>Peso real<input className={fieldClass} defaultValue={logged?.weight} inputMode="decimal" min="0" name="weight" required step="0.25" type="number" /></label>
                        <label className={labelClass}>Unidad<select className={fieldClass} defaultValue={logged?.unit ?? "KG"} name="unit"><option value="KG">kg</option><option value="LB">lb</option></select></label>
                        <label className={labelClass}>RPE real<input className={fieldClass} defaultValue={logged?.rpe ?? ""} inputMode="decimal" max="10" min="1" name="rpe" step="0.5" type="number" /></label>
                        <label className={`${labelClass} col-span-2 sm:col-span-4`}>Notas<textarea className={`${fieldClass} min-h-20 py-3`} defaultValue={logged?.notes ?? ""} name="notes" /></label>
                        <input name="completed" type="hidden" value="false" />
                        <label className="col-span-2 flex min-h-12 items-center gap-3 text-sm font-extrabold sm:col-span-4"><input defaultChecked={logged?.completed ?? false} name="completed" type="checkbox" value="true" />Serie completada</label>
                        <SubmitButton className={`${buttonClass} col-span-2 sm:col-span-4`}>Guardar serie</SubmitButton>
                      </ActionForm>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <ActionForm action={actions.completeWorkout} className="mt-5">
            <input name="assignedWorkoutId" type="hidden" value={workout.id} />
            <SubmitButton className={`${buttonClass} w-full bg-[var(--ink)]`} disabled={workout.status === "COMPLETED"}>{workout.status === "COMPLETED" ? "Entrenamiento finalizado" : "Finalizar entrenamiento"}</SubmitButton>
          </ActionForm>
          {workout.reviewNotes?.length ? <section className="mt-5 border-l-4 border-[var(--signal)] bg-white p-4" aria-label="Devolución del coach"><h3 className="font-extrabold">Devolución del coach</h3>{workout.reviewNotes.map((note) => <div className="mt-2" key={note.id}><p>{note.body}</p>{note.reply ? <p className="mt-1 text-sm text-[var(--ink-muted)]">Tu respuesta: {note.reply.body}</p> : <ActionForm action={actions.replyToReview} ariaLabel="Responder a la devolución" className="mt-3"><input name="reviewNoteId" type="hidden" value={note.id}/><label className={labelClass}>Respuesta breve<textarea className={`${fieldClass} min-h-20 py-3`} maxLength={500} name="body" required/></label><SubmitButton className={buttonClass}>Enviar respuesta</SubmitButton></ActionForm>}</div>)}</section> : null}
        </article>
      ))}
    </div>
  );
}

function shiftDate(value: string, days: number) { const date = new Date(`${value}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

function ActionForm({ action, ariaLabel, className, children }: { action: FormAction; ariaLabel?: string; className?: string; children: ReactNode }) {
  const [state, formAction] = useActionState(action, initialTrainingActionState);
  return (
    <form action={formAction} aria-label={ariaLabel} className={className}>
      {children}
      <p aria-live="polite" className={state.status === "idle" ? "sr-only" : state.status === "error" ? "text-sm font-bold text-red-700" : "text-sm font-bold text-[var(--signal-dark)]"} role={state.status === "error" ? "alert" : "status"}>
        {state.message}
      </p>
    </form>
  );
}

function SubmitButton({ className, disabled = false, children }: { className: string; disabled?: boolean; children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button aria-disabled={pending || disabled} className={className} disabled={pending || disabled} type="submit">{pending ? "Guardando…" : children}</button>;
}

function PrescriptionFields({
  exercises,
  includeLabel,
  index,
  defaultValue,
}: {
  exercises: CoachTrainingDashboard["exercises"];
  includeLabel: string;
  index: number;
  defaultValue?: CoachTrainingDashboard["templates"][number]["exercises"][number];
}) {
  return (
    <fieldset className="col-span-2 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4">
      <legend className="px-2 text-sm font-extrabold">Ejercicio {index + 1}</legend>
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm font-bold"><input defaultChecked={Boolean(defaultValue) || index === 0} name={`include-${index}`} type="checkbox" value="true" />{includeLabel}</label>
      <input name={`exerciseName-${index}`} type="hidden" value={defaultValue?.exerciseName ?? "Ejercicio"} />
      <label className={`${labelClass} col-span-2`}>Ejercicio<select className={fieldClass} defaultValue={defaultValue?.exerciseId ?? ""} name={`exerciseId-${index}`}><option value="">Elegí uno</option>{exercises.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label className={labelClass}>Orden<input className={fieldClass} defaultValue={defaultValue?.order ?? index} min="0" name={`order-${index}`} type="number" /></label>
      <label className={labelClass}>Series<input className={fieldClass} defaultValue={defaultValue?.prescribedSets ?? ""} min="1" name={`sets-${index}`} type="number" /></label>
      <label className={labelClass}>Reps mín.<input className={fieldClass} defaultValue={defaultValue?.repMin ?? ""} min="1" name={`repMin-${index}`} type="number" /></label>
      <label className={labelClass}>Reps máx.<input className={fieldClass} defaultValue={defaultValue?.repMax ?? ""} min="1" name={`repMax-${index}`} type="number" /></label>
      <label className={labelClass}>RPE objetivo<input className={fieldClass} defaultValue={defaultValue?.targetRpe ?? ""} max="10" min="1" name={`targetRpe-${index}`} step="0.5" type="number" /></label>
      <label className={labelClass}>Descanso (seg.)<input className={fieldClass} defaultValue={defaultValue?.restSeconds ?? ""} min="0" name={`restSeconds-${index}`} type="number" /></label>
      <label className={`${labelClass} col-span-2`}>Indicaciones<textarea className={`${fieldClass} min-h-20 py-3`} defaultValue={defaultValue?.notes ?? ""} name={`notes-${index}`} /></label>
    </fieldset>
  );
}

function statusLabel(status: AssignedWorkout["status"]) {
  if (status === "COMPLETED") return "Completado";
  if (status === "IN_PROGRESS") return "En curso · retomá donde dejaste";
  return "Programado";
}
