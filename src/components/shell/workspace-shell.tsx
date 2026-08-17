import { BrandMark } from "./brand-mark";
import { StatusPill } from "@/components/ui/status-pill";

const queue = [
  ["ML", "Martina López", "Pierna · Sesión 04", "Hace 18 min"],
  ["FT", "Facundo Torres", "Torso · Sesión 02", "Hace 1 h"],
  ["NA", "Nadia Acosta", "Check-in semanal", "Ayer"],
];

export function WorkspaceShell() {
  return (
    <div className="min-h-screen bg-[var(--paper-light)] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--paper)] p-6 lg:flex lg:flex-col">
        <BrandMark />
        <nav aria-label="Navegación principal" className="mt-12 space-y-2 text-sm font-bold">
          <a className="block border-l-4 border-[var(--signal)] bg-white/60 px-4 py-3" href="#inicio">Inicio</a>
          <a className="block px-5 py-3 text-[var(--ink-muted)]" href="#alumnos">Alumnos</a>
          <a className="block px-5 py-3 text-[var(--ink-muted)]" href="#planes">Planes</a>
          <a className="block px-5 py-3 text-[var(--ink-muted)]" href="#progreso">Progreso</a>
        </nav>
        <div className="mt-auto border-t border-[var(--line)] pt-5 text-sm"><strong>Fuerza Norte</strong><p className="mt-1 text-xs text-[var(--ink-muted)]">Workspace piloto</p></div>
      </aside>
      <main id="inicio">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-8 lg:px-10">
          <div className="lg:hidden"><BrandMark /></div>
          <p className="hidden text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--ink-muted)] lg:block">Panel del coach</p>
          <span className="grid size-10 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">FR</span>
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><StatusPill>Semana 32</StatusPill><h1 className="display-type mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">Buen día, Franco.</h1><p className="mt-2 text-[var(--ink-muted)]">Tenés 8 registros esperando una decisión.</p></div>
            <button className="min-h-11 rounded-full bg-[var(--signal)] px-5 text-sm font-bold text-white" type="button">+ Crear plan</button>
          </div>
          <section className="mt-10 grid gap-4 sm:grid-cols-3" aria-label="Resumen semanal">
            {[['24', 'alumnos activos'], ['08', 'para revisar'], ['91%', 'adherencia']].map(([value, label]) => <article className="border-t-4 border-[var(--ink)] bg-[var(--paper)] p-5" key={label}><p className="display-type text-5xl font-semibold">{value}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p></article>)}
          </section>
          <section className="mt-10" aria-labelledby="review-title">
            <div className="flex items-center justify-between"><h2 className="display-type text-3xl font-semibold" id="review-title">Cola de revisión</h2><a className="text-sm font-bold text-[var(--signal-dark)] underline underline-offset-4" href="#todas">Ver todas</a></div>
            <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {queue.map(([initials, name, item, time]) => <article className="grid grid-cols-[auto_1fr] items-center gap-3 py-4 sm:grid-cols-[auto_1fr_auto]" key={name}><span className="grid size-11 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">{initials}</span><div><h3 className="font-bold">{name}</h3><p className="text-sm text-[var(--ink-muted)]">{item}</p></div><time className="col-start-2 text-xs font-bold text-[var(--ink-muted)] sm:col-auto">{time}</time></article>)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
