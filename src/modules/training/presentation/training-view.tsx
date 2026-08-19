import type { AssignedWorkout, CoachTrainingDashboard } from "../application/training-service";

type FormAction = (formData: FormData) => Promise<void>;

const fieldClass = "mt-1 min-h-12 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-base";
const labelClass = "text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--ink-muted)]";
const buttonClass = "min-h-12 rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white disabled:opacity-50";

export function CoachTrainingView({
  dashboard,
  actions,
}: {
  dashboard: CoachTrainingDashboard;
  actions: { createExercise: FormAction; createTemplate: FormAction; createPlan: FormAction; assignPlan: FormAction };
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <header className="border-b-4 border-[var(--ink)] pb-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal-dark)]">Programación</p>
        <h1 className="display-type mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">Entrenamiento</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">Armá la biblioteca una vez, programá fechas concretas y asigná el bloque al alumno correcto.</p>
      </header>

      <section className="mt-9 grid gap-5 lg:grid-cols-2" aria-labelledby="exercise-library-title">
        <article className="bg-[var(--paper)] p-5 sm:p-7">
          <h2 className="display-type text-3xl font-semibold" id="exercise-library-title">Biblioteca de ejercicios</h2>
          <form action={actions.createExercise} aria-label="Crear ejercicio" className="mt-5 grid gap-4">
            <label className={labelClass}>Nombre<input className={fieldClass} name="name" required /></label>
            <label className={labelClass}>Notas técnicas<textarea className={`${fieldClass} min-h-24 py-3`} name="notes" /></label>
            <button className={buttonClass} type="submit">Guardar ejercicio</button>
          </form>
          <ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {dashboard.exercises.map((exercise) => <li className="py-3 font-bold" key={exercise.id}>{exercise.name}</li>)}
          </ul>
        </article>

        <article className="border border-[var(--line)] bg-white/60 p-5 sm:p-7">
          <h2 className="display-type text-3xl font-semibold">Plantilla práctica</h2>
          <form action={actions.createTemplate} aria-label="Crear plantilla" className="mt-5 grid grid-cols-2 gap-4">
            <label className={`${labelClass} col-span-2`}>Nombre de plantilla<input className={fieldClass} name="name" required /></label>
            <label className={`${labelClass} col-span-2`}>Ejercicio<select className={fieldClass} name="exerciseId" required><option value="">Elegí uno</option>{dashboard.exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
            <label className={labelClass}>Series<input className={fieldClass} inputMode="numeric" min="1" name="sets" required type="number" /></label>
            <label className={labelClass}>Reps mín.<input className={fieldClass} inputMode="numeric" min="1" name="repMin" required type="number" /></label>
            <label className={labelClass}>Reps máx.<input className={fieldClass} inputMode="numeric" min="1" name="repMax" required type="number" /></label>
            <label className={labelClass}>RPE objetivo<input className={fieldClass} inputMode="decimal" max="10" min="1" name="targetRpe" step="0.5" type="number" /></label>
            <label className={labelClass}>Descanso (seg.)<input className={fieldClass} inputMode="numeric" min="0" name="restSeconds" type="number" /></label>
            <label className={`${labelClass} col-span-2`}>Indicaciones<textarea className={`${fieldClass} min-h-20 py-3`} name="notes" /></label>
            <button className={`${buttonClass} col-span-2`} type="submit">Crear plantilla</button>
          </form>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" aria-label="Planificación">
        <article className="border-t-4 border-[var(--signal)] bg-[var(--ink)] p-5 text-white sm:p-7">
          <h2 className="display-type text-3xl font-semibold">Calendario del plan</h2>
          <form action={actions.createPlan} aria-label="Programar plan" className="mt-5 grid grid-cols-2 gap-4">
            <label className={`${labelClass} col-span-2 !text-white/75`}>Nombre del bloque<input className={`${fieldClass} text-[var(--ink)]`} name="name" required /></label>
            <label className={`${labelClass} !text-white/75`}>Inicio<input className={`${fieldClass} text-[var(--ink)]`} name="startsOn" required type="date" /></label>
            <label className={`${labelClass} !text-white/75`}>Fin<input className={`${fieldClass} text-[var(--ink)]`} name="endsOn" required type="date" /></label>
            <label className={`${labelClass} col-span-2 !text-white/75`}>Plantilla<select className={`${fieldClass} text-[var(--ink)]`} name="templateId" required><option value="">Elegí una</option>{dashboard.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
            <label className={`${labelClass} col-span-2 !text-white/75`}>Día del entrenamiento<input className={`${fieldClass} text-[var(--ink)]`} name="scheduledOn" required type="date" /></label>
            <button className={`${buttonClass} col-span-2 bg-[var(--signal-bright)] text-[var(--ink)]`} type="submit">Programar plan</button>
          </form>
        </article>
        <article className="bg-[var(--paper)] p-5 sm:p-7">
          <h2 className="display-type text-3xl font-semibold">Asignación</h2>
          <form action={actions.assignPlan} aria-label="Asignar plan" className="mt-5 grid gap-4">
            <label className={labelClass}>Plan<select className={fieldClass} name="planId" required><option value="">Elegí uno</option>{dashboard.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
            <label className={labelClass}>Alumno<select className={fieldClass} name="studentMembershipId" required><option value="">Elegí uno</option>{dashboard.students.map((student) => <option key={student.membershipId} value={student.membershipId}>{student.name}</option>)}</select></label>
            <button className={buttonClass} type="submit">Asignar plan</button>
          </form>
        </article>
      </section>
    </div>
  );
}

export function StudentTrainingView({
  date,
  workouts,
  actions,
}: {
  date: string;
  workouts: AssignedWorkout[];
  actions: { saveSet: FormAction; completeWorkout: FormAction };
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-8 lg:py-12">
      <header className="border-b-4 border-[var(--ink)] pb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal-dark)]">Tu agenda · {date}</p>
        <h1 className="display-type mt-2 text-5xl font-semibold">Entrenamiento de hoy</h1>
      </header>
      {workouts.length === 0 ? <p className="mt-8 bg-[var(--paper)] p-6 font-bold">No tenés una sesión programada para hoy.</p> : workouts.map((workout) => (
        <article className="mt-7" key={workout.id}>
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
                      <form action={actions.saveSet} aria-label={`Registrar serie ${setNumber} de ${exercise.exerciseName}`} className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--line)] bg-white p-4 sm:grid-cols-4" key={setNumber}>
                        <input name="assignedWorkoutId" type="hidden" value={workout.id} />
                        <input name="exerciseSnapshotId" type="hidden" value={exercise.id} />
                        <input name="setNumber" type="hidden" value={setNumber} />
                        <p className="col-span-2 text-xs font-extrabold uppercase tracking-[0.12em] sm:col-span-4">Serie {setNumber}{logged ? " · guardada" : ""}</p>
                        <label className={labelClass}>Repeticiones reales<input className={fieldClass} defaultValue={logged?.reps} inputMode="numeric" min="0" name="reps" required type="number" /></label>
                        <label className={labelClass}>Peso real<input className={fieldClass} defaultValue={logged?.weight} inputMode="decimal" min="0" name="weight" required step="0.25" type="number" /></label>
                        <label className={labelClass}>Unidad<select className={fieldClass} defaultValue={logged?.unit ?? "KG"} name="unit"><option value="KG">kg</option><option value="LB">lb</option></select></label>
                        <label className={labelClass}>RPE real<input className={fieldClass} defaultValue={logged?.rpe ?? ""} inputMode="decimal" max="10" min="1" name="rpe" step="0.5" type="number" /></label>
                        <label className={`${labelClass} col-span-2 sm:col-span-4`}>Notas<textarea className={`${fieldClass} min-h-20 py-3`} defaultValue={logged?.notes ?? ""} name="notes" /></label>
                        <button className={`${buttonClass} col-span-2 sm:col-span-4`} name="completed" type="submit" value="false">Guardar y seguir después</button>
                      </form>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <form action={actions.completeWorkout} className="mt-5">
            <input name="assignedWorkoutId" type="hidden" value={workout.id} />
            <button className={`${buttonClass} w-full bg-[var(--ink)]`} disabled={workout.status === "COMPLETED"} type="submit">{workout.status === "COMPLETED" ? "Entrenamiento finalizado" : "Finalizar entrenamiento"}</button>
          </form>
        </article>
      ))}
    </div>
  );
}

function statusLabel(status: AssignedWorkout["status"]) {
  if (status === "COMPLETED") return "Completado";
  if (status === "IN_PROGRESS") return "En curso · retomá donde dejaste";
  return "Programado";
}
