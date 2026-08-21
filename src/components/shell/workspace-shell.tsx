import { BrandMark } from "./brand-mark";
import { StatusPill } from "@/components/ui/status-pill";
import type { WorkspaceMembershipDto } from "@/modules/tenancy/application/workspace-access";

type StudentSummary = { id: string; name: string; status: string };

const defaultMembership: WorkspaceMembershipDto = {
  workspaceId: "preview",
  workspaceSlug: "fuerza-norte",
  workspaceName: "Fuerza Norte",
  timeZone: "America/Mexico_City",
  role: "COACH",
  accessMode: "MEMBERSHIP",
};

export function WorkspaceShell({
  currentMembership = defaultMembership,
  memberships = [defaultMembership],
  students = [],
}: {
  currentMembership?: WorkspaceMembershipDto;
  memberships?: WorkspaceMembershipDto[];
  students?: StudentSummary[];
}) {
  const root = `/w/${currentMembership.workspaceSlug}`;
  const coach = currentMembership.role === "COACH";
  const superAdmin = currentMembership.accessMode === "SUPER_ADMIN";
  const panelLabel = superAdmin ? "Panel de super admin" : coach ? "Panel del coach" : "Panel del alumno";
  const navigationItems = coach
    ? [
        { href: root, label: "Inicio" },
        { href: `${root}/students`, label: "Alumnos" },
        { href: `${root}/training`, label: "Entrenamiento" },
        { href: `${root}/progress`, label: "Revisiones" },
      ]
    : [
        { href: root, label: "Inicio" },
        { href: `${root}/training`, label: "Entrenamiento" },
        { href: `${root}/progress`, label: "Progreso" },
      ];

  return (
    <div className="min-h-screen bg-[var(--paper-light)] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--paper)] p-6 lg:flex lg:flex-col">
        <BrandMark />
        <Navigation items={navigationItems} mobile={false} />
        <div className="mt-auto border-t border-[var(--line)] pt-5 text-sm">
          <strong>{currentMembership.workspaceName}</strong>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{panelLabel}</p>
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
          <p className="hidden text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--ink-muted)] lg:block">{panelLabel}</p>
          <span aria-label="Perfil" className="grid size-10 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">TN</span>
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><StatusPill>Piloto activo</StatusPill><h1 className="display-type mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">{coach ? "Tu equipo, en contexto." : "Tu semana, bien clara."}</h1><p className="mt-2 text-[var(--ink-muted)]">{coach ? "Revisá el trabajo pendiente y acompañá el próximo paso." : "Entrenamiento y progreso, sin ruido."}</p></div>
            <a className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--signal)] px-5 text-sm font-bold text-white" href={coach ? `${root}/training` : `${root}/progress`}>{coach ? "+ Crear plan" : "Registrar progreso"}</a>
          </div>
          <section className="mt-10 grid gap-4 sm:grid-cols-3" aria-label="Resumen semanal">
            {[[String(students.length).padStart(2, "0"), coach ? "alumnos" : "workspace"], ["01", coach ? "flujo de revisión" : "plan activo"], ["100%", "datos privados"]].map(([value, label]) => <article className="border-t-4 border-[var(--ink)] bg-[var(--paper)] p-5" key={label}><p className="display-type text-5xl font-semibold">{value}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p></article>)}
          </section>
          {coach ? <section className="mt-10 scroll-mt-6" aria-labelledby="students-title" id="alumnos">
            <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Roster del piloto</p><h2 className="display-type mt-1 text-3xl font-semibold" id="students-title">Alumnos</h2></div><a className="text-sm font-bold text-[var(--signal-dark)] underline underline-offset-4" href={`${root}/training`}>Gestionar planes</a></div>
            {students.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{students.map((student) => <li className="border border-[var(--line)] bg-white/60 p-4" key={student.id}><strong>{student.name}</strong><p className="mt-1 text-sm text-[var(--ink-muted)]">{student.status}</p></li>)}</ul> : <div className="mt-4 border border-dashed border-[var(--line)] bg-white/50 p-6"><h3 className="font-extrabold">Todavía no hay alumnos</h3><p className="mt-1 text-sm text-[var(--ink-muted)]">Cuando acepten una invitación, van a aparecer acá listos para recibir un plan.</p></div>}
          </section> : null}
        </div>
      </main>
      <Navigation items={navigationItems} mobile />
    </div>
  );
}

function Navigation({ items, mobile }: { items: Array<{ href: string; label: string }>; mobile: boolean }) {
  return <nav aria-label={mobile ? "Navegación móvil" : "Navegación principal"} className={mobile ? "fixed inset-x-0 bottom-0 z-50 grid border-t border-white/15 bg-[var(--ink)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-white shadow-[0_-10px_30px_rgba(16,27,43,0.18)] lg:hidden" : "mt-12 space-y-2 text-sm font-bold"} style={mobile ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}>
    {items.map((item, index) => <a aria-current={index === 0 ? "page" : undefined} className={mobile ? `flex min-h-12 items-center justify-center rounded-lg px-1 text-center text-[0.7rem] font-bold ${index === 0 ? "bg-white/10 text-[var(--signal-bright)]" : "text-white"}` : index === 0 ? "block border-l-4 border-[var(--signal)] bg-white/60 px-4 py-3" : "block px-5 py-3 text-[var(--ink-muted)]"} href={item.href} key={item.href}>{item.label}</a>)}
  </nav>;
}
