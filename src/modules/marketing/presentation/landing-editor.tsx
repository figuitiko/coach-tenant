import type { ReactNode } from "react";
import type { LandingEditorDto } from "@/modules/marketing/application/marketing-service";
import type { LandingContentInput } from "@/modules/marketing/domain/contracts";
import { StatusPill } from "@/components/ui/status-pill";

const defaults: LandingContentInput = {
  themeKey: "editorial",
  coachDisplayName: "",
  heroEyebrow: "Entrenamiento personalizado",
  heroHeadline: "Entrená con un plan claro y seguimiento real.",
  heroSubheadline: "Construí fuerza, técnica y constancia con una guía pensada para tu semana.",
  valueProposition:
    "Un método simple: evaluamos dónde estás, planificamos el siguiente bloque y revisamos tu evolución con datos concretos.",
  servicesHeading: "Cómo te puedo ayudar",
  services: [
    { title: "Plan mensual", description: "Rutina estructurada según tu objetivo, disponibilidad y experiencia." },
    {
      title: "Seguimiento semanal",
      description: "Revisión de entrenamientos, ajustes y próximos pasos sin perder contexto.",
    },
  ],
  methodologyHeading: "Método de trabajo",
  methodology: [
    { title: "Diagnóstico", description: "Entendemos tu punto de partida, historial y restricciones." },
    { title: "Plan", description: "Convertimos el objetivo en sesiones concretas y medibles." },
    { title: "Revisión", description: "Miramos registros y progreso para ajustar con criterio." },
  ],
  resultsHeading: "Resultados reales",
  aboutHeading: "Sobre el coach",
  aboutBody: "Contá quién sos, qué tipo de alumnos ayudás y cuál es tu filosofía de entrenamiento.",
  faqHeading: "Preguntas frecuentes",
  faqs: [
    { question: "¿Necesito experiencia previa?", answer: "No. El plan se adapta a tu nivel actual." },
    {
      question: "¿Cómo hacemos seguimiento?",
      answer: "Registrás tus entrenamientos y medidas; yo reviso y ajusto el camino.",
    },
  ],
  ctaHeading: "¿Querés empezar?",
  ctaBody: "Mandame un mensaje y vemos si este acompañamiento encaja con tu objetivo.",
  whatsappDigits: "541112345678",
  whatsappMessage: "Hola, quiero conocer tus planes de entrenamiento.",
  instagramUrl: null,
  publicEmail: null,
  seoTitle: null,
  seoDescription: null,
  resultAttributionMode: "ANONYMOUS",
};

type LandingFormAction = (data: FormData) => Promise<void> | void;

type Props = {
  workspaceSlug: string;
  editor: LandingEditorDto;
  notice?: "saved" | "published" | "unpublished" | null;
  actions: {
    saveDraft: LandingFormAction;
    publish: LandingFormAction;
    unpublish: LandingFormAction;
  };
};

export function LandingEditor({ workspaceSlug, editor, notice = null, actions }: Props) {
  const content = { ...defaults, ...editor.draftContent };
  const saveAction = actions.saveDraft;
  const publishAction = actions.publish;
  const unpublishAction = actions.unpublish;
  const published = Boolean(editor.publishedRevisionId);
  const draftIsLive = editor.currentDraftRevisionId && editor.currentDraftRevisionId === editor.publishedRevisionId;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper)] shadow-[8px_8px_0_var(--ink)]">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <StatusPill>Landing pública</StatusPill>
            <h1 className="display-type mt-5 max-w-3xl text-5xl leading-[0.9] font-semibold tracking-[-0.045em] sm:text-6xl">
              Vendé tu método sin mostrar datos privados.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-muted)]">
              Editá el borrador de {editor.workspaceName}, previsualizalo y publicalo recién cuando estés conforme. Lo
              publicado no cambia hasta que presiones publicar otra vez.
            </p>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-3 lg:grid-cols-1">
            <StatusCard label="Estado" value={published ? "Publicada" : "Privada"} />
            <StatusCard
              label="Borrador"
              value={editor.currentDraftRevisionNumber ? `Rev. ${editor.currentDraftRevisionNumber}` : "Nuevo"}
            />
            <StatusCard label="Sincronía" value={draftIsLive ? "En vivo" : "Hay cambios"} />
          </div>
        </div>
        {notice ? (
          <p className="border-t border-[var(--line)] bg-white/60 px-5 py-3 text-sm font-bold text-[var(--signal-dark)] sm:px-7 lg:px-8">
            {notice === "saved"
              ? "Borrador guardado."
              : notice === "published"
                ? "Landing publicada."
                : "Landing despublicada."}
          </p>
        ) : null}
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <form action={saveAction} className="space-y-5">
          <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
          <input name="expectedRevisionNumber" type="hidden" value={editor.currentDraftRevisionNumber || ""} />
          <input name="logoAssetId" type="hidden" value={editor.logoAssetId ?? ""} />
          <input name="portraitAssetId" type="hidden" value={editor.portraitAssetId ?? ""} />
          <input name="selectedResultVersionIds" type="hidden" value={editor.selectedResultVersionIds.join(",")} />

          <Panel eyebrow="01" title="Identidad y hero">
            <Field
              label="Nombre público del coach"
              name="coachDisplayName"
              required
              defaultValue={content.coachDisplayName}
            />
            <Field label="Eyebrow" name="heroEyebrow" defaultValue={content.heroEyebrow ?? ""} />
            <Field label="Título principal" name="heroHeadline" required defaultValue={content.heroHeadline} />
            <TextArea
              label="Subtítulo"
              name="heroSubheadline"
              required
              defaultValue={content.heroSubheadline}
              rows={3}
            />
            <TextArea
              label="Propuesta de valor"
              name="valueProposition"
              defaultValue={content.valueProposition ?? ""}
              rows={4}
            />
          </Panel>

          <Panel eyebrow="02" title="Servicios">
            <Field label="Título de sección" name="servicesHeading" defaultValue={content.servicesHeading ?? ""} />
            {[0, 1, 2].map((index) => (
              <RepeaterPair
                key={index}
                number={index + 1}
                titleName={`service${index + 1}Title`}
                descriptionName={`service${index + 1}Description`}
                title={content.services?.[index]?.title ?? ""}
                description={content.services?.[index]?.description ?? ""}
              />
            ))}
          </Panel>

          <Panel eyebrow="03" title="Método">
            <Field
              label="Título de sección"
              name="methodologyHeading"
              defaultValue={content.methodologyHeading ?? ""}
            />
            {[0, 1, 2].map((index) => (
              <RepeaterPair
                key={index}
                number={index + 1}
                titleName={`method${index + 1}Title`}
                descriptionName={`method${index + 1}Description`}
                title={content.methodology?.[index]?.title ?? ""}
                description={content.methodology?.[index]?.description ?? ""}
              />
            ))}
          </Panel>

          <Panel eyebrow="04" title="Sobre vos y FAQ">
            <Field label="Título resultados" name="resultsHeading" defaultValue={content.resultsHeading ?? ""} />
            <Field label="Título sobre el coach" name="aboutHeading" defaultValue={content.aboutHeading ?? ""} />
            <TextArea label="Bio / enfoque" name="aboutBody" defaultValue={content.aboutBody ?? ""} rows={5} />
            <Field label="Título FAQ" name="faqHeading" defaultValue={content.faqHeading ?? ""} />
            {[0, 1, 2].map((index) => (
              <FaqPair
                key={index}
                number={index + 1}
                question={content.faqs?.[index]?.question ?? ""}
                answer={content.faqs?.[index]?.answer ?? ""}
              />
            ))}
          </Panel>

          <Panel eyebrow="05" title="Conversión y SEO">
            <Field label="CTA título" name="ctaHeading" required defaultValue={content.ctaHeading} />
            <TextArea label="CTA texto" name="ctaBody" defaultValue={content.ctaBody ?? ""} rows={3} />
            <Field
              label="WhatsApp internacional"
              name="whatsappDigits"
              required
              defaultValue={content.whatsappDigits}
            />
            <TextArea
              label="Mensaje prellenado"
              name="whatsappMessage"
              required
              defaultValue={content.whatsappMessage}
              rows={3}
            />
            <Field label="Instagram HTTPS" name="instagramUrl" defaultValue={content.instagramUrl ?? ""} />
            <Field label="Email público" name="publicEmail" type="email" defaultValue={content.publicEmail ?? ""} />
            <Field label="SEO title" name="seoTitle" defaultValue={content.seoTitle ?? ""} />
            <TextArea
              label="SEO description"
              name="seoDescription"
              defaultValue={content.seoDescription ?? ""}
              rows={3}
            />
          </Panel>

          <div className="sticky bottom-20 z-30 rounded-[2rem] border border-[var(--line)] bg-[var(--paper-light)]/95 p-3 shadow-2xl backdrop-blur lg:bottom-4">
            <button
              className="min-h-12 w-full rounded-full bg-[var(--signal)] px-6 text-sm font-extrabold text-white transition hover:bg-[var(--signal-dark)]"
              type="submit"
            >
              Guardar borrador
            </button>
          </div>
        </form>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <LandingPreviewCard content={content} workspaceSlug={workspaceSlug} published={published} />
          <section className="rounded-[2rem] border border-[var(--line)] bg-white/60 p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Publicación</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Guardar crea una revisión privada. Publicar mueve esa revisión a la URL pública. Despublicar apaga la
              landing sin borrar el borrador.
            </p>
            <div className="mt-4 grid gap-2">
              <form action={publishAction}>
                <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
                <input name="revisionId" type="hidden" value={editor.currentDraftRevisionId ?? ""} />
                <input name="expectedRevisionNumber" type="hidden" value={editor.currentDraftRevisionNumber} />
                <button
                  className="min-h-11 w-full rounded-full bg-[var(--ink)] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!editor.currentDraftRevisionId}
                  type="submit"
                >
                  Publicar borrador
                </button>
              </form>
              <form action={unpublishAction}>
                <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
                <input name="publishedRevisionId" type="hidden" value={editor.publishedRevisionId ?? ""} />
                <button
                  className="min-h-11 w-full rounded-full border border-[var(--line)] px-5 text-sm font-extrabold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!editor.publishedRevisionId}
                  type="submit"
                >
                  Despublicar
                </button>
              </form>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 text-sm font-extrabold"
                href={`/c/${workspaceSlug}`}
                target="_blank"
              >
                Ver URL pública
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-[var(--line)] bg-white/70 p-4">
      <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{label}</p>
      <p className="display-type mt-1 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-white/70 p-5 shadow-sm sm:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--signal-dark)]">{eyebrow}</p>
      <h2 className="display-type mt-1 text-3xl font-semibold">{title}</h2>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--ink)]">
      <span>{label}</span>
      <input
        className="min-h-12 rounded-2xl border border-[var(--line)] bg-[var(--paper-light)] px-4 text-base outline-none transition focus:border-[var(--signal)]"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  required = false,
  rows,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  rows: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--ink)]">
      <span>{label}</span>
      <textarea
        className="rounded-2xl border border-[var(--line)] bg-[var(--paper-light)] px-4 py-3 text-base leading-7 outline-none transition focus:border-[var(--signal)]"
        defaultValue={defaultValue}
        name={name}
        required={required}
        rows={rows}
      />
    </label>
  );
}

function RepeaterPair({
  number,
  titleName,
  descriptionName,
  title,
  description,
}: {
  number: number;
  titleName: string;
  descriptionName: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-[var(--line)] p-3 sm:grid-cols-[0.25fr_1fr_1.4fr] sm:items-end">
      <p className="display-type text-3xl font-semibold text-[var(--signal)]">{String(number).padStart(2, "0")}</p>
      <Field label="Título" name={titleName} defaultValue={title} />
      <Field label="Descripción" name={descriptionName} defaultValue={description} />
    </div>
  );
}

function FaqPair({ number, question, answer }: { number: number; question: string; answer: string }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-[var(--line)] p-3 sm:grid-cols-[0.25fr_1fr_1.4fr] sm:items-end">
      <p className="display-type text-3xl font-semibold text-[var(--signal)]">{String(number).padStart(2, "0")}</p>
      <Field label="Pregunta" name={`faq${number}Question`} defaultValue={question} />
      <Field label="Respuesta" name={`faq${number}Answer`} defaultValue={answer} />
    </div>
  );
}

function LandingPreviewCard({
  content,
  workspaceSlug,
  published,
}: {
  content: LandingContentInput;
  workspaceSlug: string;
  published: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border-2 border-[var(--ink)] bg-[var(--paper)] shadow-[8px_8px_0_var(--ink)]">
      <div className="border-b border-[var(--line)] p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal-dark)]">
          Preview editorial
        </p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          /c/{workspaceSlug} · {published ? "publicada" : "privada"}
        </p>
      </div>
      <div className="paper-grain p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal)]">{content.heroEyebrow}</p>
        <h3 className="display-type mt-4 text-4xl leading-[0.92] font-semibold tracking-[-0.04em]">
          {content.heroHeadline}
        </h3>
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">{content.heroSubheadline}</p>
        <div className="mt-5 grid gap-2">
          {(content.services ?? []).slice(0, 2).map((service) => (
            <article className="border-l-4 border-[var(--signal)] bg-white/60 p-3" key={service.title}>
              <strong>{service.title}</strong>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">{service.description}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 rounded-full bg-[var(--signal)] px-4 py-3 text-center text-sm font-extrabold text-white">
          {content.ctaHeading}
        </p>
      </div>
    </section>
  );
}
