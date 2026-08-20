"use client";
export default function WorkspaceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[var(--paper-light)] p-6"><section className="max-w-md border-t-4 border-[var(--signal)] bg-white p-8"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[var(--signal-dark)]">Pausa breve</p><h1 className="display-type mt-2 text-4xl font-semibold">No pudimos cargar este workspace.</h1><p className="mt-3 text-sm text-[var(--ink-muted)]">Tus datos siguen guardados. Probá de nuevo en un momento.</p><button className="mt-6 min-h-11 rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-white" onClick={retry}>Volver a intentar</button></section></main>;
}
