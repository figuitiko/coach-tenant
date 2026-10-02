import Link from "next/link";
import { redirect } from "next/navigation";
import { createManualCoachAction } from "@/app/actions/members";
import { selectWorkspaceEntry } from "@/modules/tenancy/application/workspace-access";
import { listCurrentMemberships } from "@/modules/tenancy/infrastructure/workspace-dal";
import { SuperAdminCoachCreateForm } from "@/modules/tenancy/presentation/super-admin-coach-create-form";

export const runtime = "nodejs";

export default async function WorkspacePage() {
  const current = await listCurrentMemberships();
  if (!current) return redirect("/sign-in");

  const isSuperAdmin = current.platformRole === "SUPER_ADMIN";
  const directEntry = isSuperAdmin ? null : selectWorkspaceEntry(current.memberships);
  if (directEntry) return redirect(directEntry);

  if (isSuperAdmin) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-5 py-16">
        <header className="border-b-4 border-[var(--ink)] pb-6">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">
            Administración global
          </p>
          <h1 className="display-type mt-2 text-5xl font-semibold">Super admin</h1>
          <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">
            Creá coaches con su propio workspace y entrá a cualquier workspace solo para soporte o revisión.
          </p>
        </header>

        <SuperAdminCoachCreateForm createManualCoach={createManualCoachAction} />

        <section className="mt-10" aria-labelledby="global-workspaces-title">
          <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">
                Coaches creados
              </p>
              <h2 className="display-type text-3xl font-semibold" id="global-workspaces-title">
                Workspaces de coaches
              </h2>
            </div>
            <p className="text-sm text-[var(--ink-muted)]">Entrás solo para soporte o revisión.</p>
          </div>

          {current.memberships.length === 0 ? (
            <p className="mt-5 border border-dashed border-[var(--line)] bg-white/50 p-5 text-[var(--ink-muted)]">
              Todavía no hay workspaces creados.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {current.memberships.map((membership) => (
                <li key={membership.workspaceId}>
                  <Link
                    className="flex items-center justify-between gap-4 border border-[var(--line)] bg-white/60 p-5 font-bold hover:border-[var(--ink)]"
                    href={`/w/${membership.workspaceSlug}`}
                  >
                    <span>
                      <span className="block">{membership.workspaceName}</span>
                      <span className="mt-1 block text-xs font-semibold text-[var(--ink-muted)]">
                        Workspace del coach
                      </span>
                    </span>
                    <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs uppercase tracking-[.08em] text-[var(--ink-muted)]">
                      Ver workspace
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-16">
      <h1 className="display-type text-5xl font-semibold">Elegí un workspace</h1>
      {current.memberships.length === 0 ? (
        <p className="mt-5 text-[var(--ink-muted)]">Tu cuenta todavía no tiene acceso a un workspace.</p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {current.memberships.map((membership) => (
            <li key={membership.workspaceId}>
              <Link
                className="block border border-[var(--line)] bg-white/60 p-5 font-bold hover:border-[var(--ink)]"
                href={`/w/${membership.workspaceSlug}`}
              >
                {membership.workspaceName}{" "}
                <span className="ml-2 text-xs text-[var(--ink-muted)]">{membership.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
