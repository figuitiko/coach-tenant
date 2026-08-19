import { BrandMark } from "./brand-mark";
import { StatusPill } from "@/components/ui/status-pill";
import type { WorkspaceMembershipDto } from "@/modules/tenancy/application/workspace-access";

const queue = [
  ["ML", "Martina López", "Pierna · Sesión 04", "Hace 18 min"],
  ["FT", "Facundo Torres", "Torso · Sesión 02", "Hace 1 h"],
  ["NA", "Nadia Acosta", "Check-in semanal", "Ayer"],
];

const navigationItems = [
  { href: "#inicio", label: "Inicio" },
  { href: "#resumen", label: "Resumen" },
  { href: "#revisiones", label: "Revisiones" },
  { href: "#perfil", label: "Perfil" },
];

const defaultMembership: WorkspaceMembershipDto = {
  workspaceId: "preview",
  workspaceSlug: "fuerza-norte",
  workspaceName: "Fuerza Norte",
  timeZone: "America/Mexico_City",
  role: "COACH",
};

export function WorkspaceShell({
  currentMembership = defaultMembership,
  memberships = [defaultMembership],
}: {
  currentMembership?: WorkspaceMembershipDto;
  memberships?: WorkspaceMembershipDto[];
}) {
  return (
    <div className="min-h-screen bg-[var(--paper-light)] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--paper)] p-6 lg:flex lg:flex-col">
        <BrandMark />
        <nav aria-label="Navegación principal" className="mt-12 space-y-2 text-sm font-bold">
          {navigationItems.map((item, index) => (
            <a
              aria-current={index === 0 ? "page" : undefined}
              className={index === 0 ? "block border-l-4 border-[var(--signal)] bg-white/60 px-4 py-3" : "block px-5 py-3 text-[var(--ink-muted)]"}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto border-t border-[var(--line)] pt-5 text-sm">
          <strong>{currentMembership.workspaceName}</strong>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{currentMembership.role === "COACH" ? "Panel del coach" : "Panel del alumno"}</p>
          {memberships.filter((membership) => membership.workspaceId !== currentMembership.workspaceId).map((membership) => (
            <a className="mt-3 block text-xs font-bold text-[var(--signal-dark)] underline underline-offset-4" href={`/w/${membership.workspaceSlug}`} key={membership.workspaceId}>
              Cambiar a {membership.workspaceName}
            </a>
          ))}
        </div>
      </aside>
      <main className="pb-24 lg:pb-0" id="inicio">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-8 lg:px-10">
          <div className="lg:hidden"><BrandMark /></div>
          <p className="hidden text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--ink-muted)] lg:block">Panel {currentMembership.role === "COACH" ? "del coach" : "del alumno"}</p>
          <span className="grid size-10 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white" id="perfil">FR</span>
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><StatusPill>Semana 32</StatusPill><h1 className="display-type mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">Buen día, Franco.</h1><p className="mt-2 text-[var(--ink-muted)]">Tenés 8 registros esperando una decisión.</p></div>
            <button className="min-h-11 rounded-full bg-[var(--signal)] px-5 text-sm font-bold text-white" type="button">+ Crear plan</button>
          </div>
          <section className="mt-10 grid scroll-mt-6 gap-4 sm:grid-cols-3" aria-label="Resumen semanal" id="resumen">
            {[['24', 'alumnos activos'], ['08', 'para revisar'], ['91%', 'adherencia']].map(([value, label]) => <article className="border-t-4 border-[var(--ink)] bg-[var(--paper)] p-5" key={label}><p className="display-type text-5xl font-semibold">{value}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p></article>)}
          </section>
          <section className="mt-10 scroll-mt-6" aria-labelledby="review-title" id="revisiones">
            <div className="flex items-center justify-between"><h2 className="display-type text-3xl font-semibold" id="review-title">Cola de revisión</h2><a className="text-sm font-bold text-[var(--signal-dark)] underline underline-offset-4" href="#todas">Ver todas</a></div>
            <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {queue.map(([initials, name, item, time]) => <article className="grid grid-cols-[auto_1fr] items-center gap-3 py-4 sm:grid-cols-[auto_1fr_auto]" key={name}><span className="grid size-11 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">{initials}</span><div><h3 className="font-bold">{name}</h3><p className="text-sm text-[var(--ink-muted)]">{item}</p></div><time className="col-start-2 text-xs font-bold text-[var(--ink-muted)] sm:col-auto">{time}</time></article>)}
            </div>
          </section>
        </div>
      </main>
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-white/15 bg-[var(--ink)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-white shadow-[0_-10px_30px_rgba(16,27,43,0.18)] lg:hidden"
      >
        {navigationItems.map((item, index) => (
          <a
            aria-current={index === 0 ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-lg px-1 text-center text-[0.7rem] font-bold ${index === 0 ? "bg-white/10 text-[var(--signal-bright)]" : "text-white"}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
