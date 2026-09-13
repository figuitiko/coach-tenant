import Link from "next/link";
import { SignOutAction } from "@/components/auth/sign-out-action";

export function WorkspaceNavigation({ workspaceSlug, role }: { workspaceSlug: string; role: "COACH" | "STUDENT" }) {
  const root = `/w/${workspaceSlug}`;
  const items =
    role === "COACH"
      ? [
          [root, "Inicio"],
          [`${root}/students`, "Alumnos"],
          [`${root}/training`, "Entrenamiento"],
          [`${root}/progress`, "Revisiones"],
          [`${root}/landing`, "Landing"],
        ]
      : [
          [root, "Inicio"],
          [`${root}/training`, "Entrenamiento"],
          [`${root}/progress`, "Progreso"],
          [`${root}/results`, "Resultados"],
        ];

  return (
    <>
      <nav
        aria-label="Navegación del workspace"
        className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-[var(--paper)]/95 px-5 py-3 backdrop-blur lg:flex lg:justify-center lg:gap-2"
      >
        {items.map(([href, label]) => (
          <Link
            className="min-h-11 rounded-full px-4 py-3 text-sm font-extrabold text-[var(--ink-muted)] hover:bg-white hover:text-[var(--ink)]"
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
        <SignOutAction variant="topbar" />
      </nav>
      <nav
        aria-label="Navegación móvil del workspace"
        className="fixed inset-x-0 bottom-0 z-50 grid border-t border-white/15 bg-[var(--ink)] px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 text-white lg:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        {items.map(([href, label]) => (
          <Link
            className="flex min-h-12 items-center justify-center rounded-lg px-1 text-center text-[.7rem] font-bold"
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
        <SignOutAction variant="mobile" />
      </nav>
    </>
  );
}
