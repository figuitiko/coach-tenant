import { ActionLink } from "@/components/ui/action-link";
import { StatusPill } from "@/components/ui/status-pill";
import { BrandMark } from "./brand-mark";

const metrics = [
  { value: "08", label: "revisiones pendientes" },
  { value: "92%", label: "sesiones completadas" },
  { value: "+14", label: "marcas personales" },
];

export function PublicLanding() {
  return (
    <main className="paper-grain min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <BrandMark />
        <ActionLink href="/sign-in" tone="quiet">
          Iniciar sesión
        </ActionLink>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-12 lg:pb-24 lg:pt-20">
        <div className="reveal relative z-10">
          <StatusPill>Tu método, en un solo lugar</StatusPill>
          <h1 className="display-type mt-7 max-w-3xl text-[clamp(3.4rem,10vw,7.8rem)] leading-[0.82] font-medium tracking-[-0.065em]">
            Cada progreso merece <em className="text-[var(--signal)]">dirección.</em>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg">
            Planificá entrenamientos, revisá cada registro y seguí la evolución de tus alumnos sin perseguir mensajes ni planillas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ActionLink href="/workspace">Entrar al workspace</ActionLink>
            <ActionLink href="#metodo" tone="quiet">
              Ver cómo funciona
            </ActionLink>
          </div>
        </div>

        <div className="reveal reveal-delayed relative mx-auto w-full max-w-xl lg:mx-0">
          <div aria-hidden="true" className="absolute -right-24 -top-20 size-52 rounded-full border-[36px] border-[var(--signal)] opacity-90" />
          <div className="relative rotate-[-1.5deg] border-2 border-[var(--ink)] bg-[var(--paper-light)] p-4 shadow-[12px_12px_0_var(--ink)] sm:p-6">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal)]">Pulso semanal</p>
                <p className="display-type mt-1 text-3xl font-semibold">Lunes, 07:40</p>
              </div>
              <span className="rounded-full bg-[#d9e3d5] px-3 py-1 text-xs font-bold">En ritmo</span>
            </div>
            <div className="grid gap-3 py-5 sm:grid-cols-3">
              {metrics.map((metric) => (
                <article className="border border-[var(--line)] bg-white/60 p-4" key={metric.label}>
                  <p className="display-type text-4xl font-semibold tracking-tight">{metric.value}</p>
                  <p className="mt-2 text-xs leading-5 font-bold text-[var(--ink-muted)]">{metric.label}</p>
                </article>
              ))}
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-[var(--line)] pt-4 text-sm">
              <span className="grid size-10 place-items-center rounded-full bg-[var(--ink)] font-bold text-white">ML</span>
              <span><strong className="block">Martina López</strong><span className="text-[var(--ink-muted)]">Registro listo para revisar</span></span>
              <span className="font-extrabold text-[var(--signal)]">+3.5%</span>
            </div>
          </div>
        </div>
      </section>

      <section id="metodo" className="border-y-2 border-[var(--ink)] bg-[var(--ink)] px-5 py-10 text-[var(--paper)] sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-3">
          {[
            ["01", "Planificá", "Armá una vez. Adaptá con criterio."],
            ["02", "Observá", "Datos claros, no ruido operativo."],
            ["03", "Dirigí", "Feedback puntual para el próximo paso."],
          ].map(([number, title, copy]) => (
            <article className="border-l border-white/20 pl-5" key={number}>
              <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--signal)]">{number}</p>
              <h2 className="display-type mt-3 text-3xl">{title}</h2>
              <p className="mt-2 text-sm text-white/65">{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
