export default function WorkspaceLoading() {
  return <main aria-busy="true" aria-label="Cargando workspace" className="min-h-screen bg-[var(--paper-light)] px-5 py-12"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-4 w-28 bg-[var(--line)]"/><div className="mt-5 h-14 max-w-xl bg-[var(--line)]"/><div className="mt-10 grid gap-4 sm:grid-cols-3">{[1,2,3].map(item => <div className="h-32 bg-[var(--paper)]" key={item}/>)}</div><p className="sr-only">Estamos preparando tu workspace.</p></div></main>;
}
