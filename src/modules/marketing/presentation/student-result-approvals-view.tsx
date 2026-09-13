import type { StudentResultApprovalDto } from "@/modules/marketing/application/marketing-service";

type ResultAction = (data: FormData) => Promise<void> | void;

type Props = {
  approvals: StudentResultApprovalDto[];
  notice?: "approved" | "revoked" | "error" | null;
  actions: { approve: ResultAction; revoke: ResultAction };
};

const stateCopy = {
  PENDING: {
    label: "Pendiente",
    tone: "bg-[var(--signal)] text-white",
    help: "Tu coach quiere usar esta versión exacta en su landing.",
  },
  APPROVED: {
    label: "Aprobado",
    tone: "bg-[#d9e3d5] text-[var(--ink)]",
    help: "Esta versión puede aparecer si el coach publica la landing.",
  },
  REVOKED: {
    label: "Revocado",
    tone: "bg-white text-[var(--ink-muted)]",
    help: "Esta versión ya no puede publicarse en futuras lecturas.",
  },
  SUPERSEDED: {
    label: "Reemplazado",
    tone: "bg-white text-[var(--ink-muted)]",
    help: "Tu coach creó una versión nueva; esta ya no se aprueba.",
  },
} as const;

export function StudentResultApprovalsView({ approvals, notice = null, actions }: Props) {
  const pending = approvals.filter((approval) => approval.state === "PENDING").length;
  const approved = approvals.filter((approval) => approval.state === "APPROVED").length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <header className="grid gap-6 border-b-4 border-[var(--ink)] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--signal-dark)]">
            Consentimiento público
          </p>
          <h1 className="display-type mt-2 text-5xl leading-[0.9] font-semibold tracking-[-0.04em] sm:text-6xl">
            Tus resultados, bajo tu control.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">
            Aprobá solamente el texto y las métricas exactas que ves acá. Si algo cambia, tu coach tiene que pedirte una
            nueva aprobación.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-72">
          <Stat value={String(pending).padStart(2, "0")} label="pendientes" />
          <Stat value={String(approved).padStart(2, "0")} label="aprobados" />
        </div>
      </header>

      {notice ? <Notice notice={notice} /> : null}

      {approvals.length ? (
        <ol className="mt-8 grid gap-5">
          {approvals.map((approval) => (
            <ResultApprovalCard actions={actions} approval={approval} key={approval.versionId} />
          ))}
        </ol>
      ) : (
        <section className="mt-8 rounded-[2rem] border border-dashed border-[var(--line)] bg-white/70 p-7">
          <h2 className="display-type text-3xl font-semibold">No hay resultados para revisar</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Cuando tu coach prepare una tarjeta de progreso para su landing, va a aparecer acá antes de que pueda
            publicarse.
          </p>
        </section>
      )}
    </div>
  );
}

function ResultApprovalCard({ approval, actions }: { approval: StudentResultApprovalDto; actions: Props["actions"] }) {
  const state = stateCopy[approval.state];
  const canApprove = approval.state === "PENDING";
  const canRevoke = approval.state === "APPROVED";

  return (
    <li className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white/75 shadow-sm">
      <article className="grid gap-0 lg:grid-cols-[1fr_17rem]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] ${state.tone}`}>
              {state.label}
            </span>
            <span className="text-xs font-bold text-[var(--ink-muted)]">Versión {approval.versionNumber}</span>
          </div>
          <h2 className="display-type mt-4 text-3xl font-semibold">{approval.content.headline}</h2>
          {approval.content.narrative ? (
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{approval.content.narrative}</p>
          ) : null}
          {approval.content.testimonial ? (
            <blockquote className="mt-4 border-l-4 border-[var(--signal)] bg-[var(--paper-light)] p-4 text-sm leading-6">
              “{approval.content.testimonial}”
            </blockquote>
          ) : null}
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            {approval.content.metrics.map((metric) => (
              <div className="border-t border-[var(--line)] pt-3" key={`${approval.versionId}-${metric.order}`}>
                <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                  {metric.label}
                </dt>
                <dd className="mt-1 font-bold">
                  {metric.beforeValue} → {metric.afterValue} {unitLabel(metric.unit)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-2xl bg-[var(--paper-light)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
            Fingerprint exacto:{" "}
            <code className="font-bold text-[var(--ink)]">{approval.fingerprint.slice(0, 16)}…</code>
          </p>
        </div>
        <aside className="border-t border-[var(--line)] bg-[var(--paper)] p-5 lg:border-l lg:border-t-0">
          <p className="text-sm leading-6 text-[var(--ink-muted)]">{state.help}</p>
          <div className="mt-5 grid gap-3">
            <form action={actions.approve}>
              <input name="fingerprint" type="hidden" value={approval.fingerprint} />
              <input
                name="idempotencyKey"
                type="hidden"
                value={`approve-${approval.versionId}-${approval.fingerprint}`}
              />
              <input name="resultVersionId" type="hidden" value={approval.versionId} />
              <button
                className="min-h-11 w-full rounded-full bg-[var(--signal)] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canApprove}
                type="submit"
              >
                Aprobar versión exacta
              </button>
            </form>
            <form action={actions.revoke}>
              <input name="idempotencyKey" type="hidden" value={`revoke-${approval.versionId}`} />
              <input name="resultVersionId" type="hidden" value={approval.versionId} />
              <button
                className="min-h-11 w-full rounded-full border border-[var(--line)] px-5 text-sm font-extrabold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canRevoke}
                type="submit"
              >
                Revocar aprobación
              </button>
            </form>
          </div>
        </aside>
      </article>
    </li>
  );
}

function Notice({ notice }: { notice: NonNullable<Props["notice"]> }) {
  const message =
    notice === "approved"
      ? "Aprobación guardada."
      : notice === "revoked"
        ? "Aprobación revocada."
        : "No pudimos aplicar el cambio. Puede que la versión haya cambiado.";
  return (
    <p
      className={`mt-6 rounded-full px-4 py-3 text-sm font-extrabold ${notice === "error" ? "bg-red-50 text-red-700" : "bg-white text-[var(--signal-dark)]"}`}
      role={notice === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <article className="border border-[var(--line)] bg-white/70 p-4">
      <p className="display-type text-4xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p>
    </article>
  );
}

function unitLabel(unit: string) {
  return unit === "PERCENT" ? "%" : unit.toLowerCase();
}
