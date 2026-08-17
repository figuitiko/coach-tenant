import type { ReactNode } from "react";

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em]">
      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--signal)]" />
      {children}
    </span>
  );
}
