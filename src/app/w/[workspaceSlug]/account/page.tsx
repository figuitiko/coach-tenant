import { notFound, redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { WorkspaceNavigation } from "@/components/shell/workspace-navigation";
import { changePasswordAction } from "./actions";
import { CrossTenantAccessError, UnauthenticatedError } from "@/modules/tenancy/application/workspace-access";
import { requireWorkspaceAccess } from "@/modules/tenancy/infrastructure/workspace-dal";

export const runtime = "nodejs";

export default async function AccountPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  let role: "COACH" | "STUDENT";

  try {
    const access = await requireWorkspaceAccess(workspaceSlug);
    role = access.workspace.role;
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/sign-in");
    if (error instanceof CrossTenantAccessError) notFound();
    throw error;
  }

  return (
    <main className="min-h-screen bg-[var(--paper-light)] pb-24 lg:pb-12">
      <WorkspaceNavigation workspaceSlug={workspaceSlug} role={role} />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <header className="border-b-4 border-[var(--ink)] pb-6">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[var(--signal-dark)]">Cuenta</p>
          <h1 className="display-type mt-2 text-5xl font-semibold">Cambiar contraseña</h1>
          <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">
            Actualizá tu contraseña usando la contraseña actual. Esto aplica para coaches y alumnos.
          </p>
        </header>
        <ChangePasswordForm workspaceSlug={workspaceSlug} changePassword={changePasswordAction} />
      </div>
    </main>
  );
}
