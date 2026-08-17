import Link from "next/link";
import { redirect } from "next/navigation";
import { selectWorkspaceEntry } from "@/modules/tenancy/application/workspace-access";
import { listCurrentMemberships } from "@/modules/tenancy/infrastructure/workspace-dal";

export const runtime = "nodejs";

export default async function WorkspacePage() {
  const current = await listCurrentMemberships();
  if (!current) return redirect("/sign-in");
  const directEntry = selectWorkspaceEntry(current.memberships);
  if (directEntry) return redirect(directEntry);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-16">
      <h1 className="display-type text-5xl font-semibold">Elegí un workspace</h1>
      {current.memberships.length === 0 ? (
        <p className="mt-5 text-[var(--ink-muted)]">Tu cuenta todavía no tiene acceso a un workspace.</p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {current.memberships.map((membership) => (
            <li key={membership.workspaceId}>
              <Link className="block border border-[var(--line)] bg-white/60 p-5 font-bold hover:border-[var(--ink)]" href={`/w/${membership.workspaceSlug}`}>
                {membership.workspaceName} <span className="ml-2 text-xs text-[var(--ink-muted)]">{membership.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
