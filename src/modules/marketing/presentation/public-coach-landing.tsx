import type { PublicCoachLandingDto } from "@/modules/marketing/domain/dto";

export function PublicCoachLanding({ landing }: { landing: PublicCoachLandingDto }) {
  return (
    <main className="paper-grain min-h-screen overflow-hidden bg-[var(--paper-light)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a className="inline-flex items-center gap-3 font-extrabold" href="#contacto">
          {landing.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-10 rounded-full border border-[var(--line)] object-cover"
              src={landing.brand.logoUrl}
            />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-[var(--ink)] text-white">
              {initials(landing.brand.coachDisplayName)}
            </span>
          )}
          <span>{landing.brand.coachDisplayName}</span>
        </a>
        <a
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-extrabold"
          href={landing.cta.href}
        >
          WhatsApp
        </a>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12 lg:pb-24 lg:pt-16">
        <div className="reveal">
          {landing.hero.eyebrow ? (
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--signal-dark)]">
              {landing.hero.eyebrow}
            </p>
          ) : null}
          <h1 className="display-type mt-5 max-w-4xl text-[clamp(3.3rem,9vw,7.4rem)] leading-[0.83] font-semibold tracking-[-0.065em]">
            {landing.hero.headline}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--ink-muted)]">{landing.hero.subheadline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--signal)] px-6 text-sm font-extrabold text-white"
              href={landing.cta.href}
            >
              {landing.cta.heading}
            </a>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--line)] px-6 text-sm font-extrabold"
              href="#metodo"
            >
              Ver método
            </a>
          </div>
        </div>
        <div className="reveal reveal-delayed relative">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 size-40 rounded-full border-[30px] border-[var(--signal)]"
          />
          <div className="relative rotate-[-1deg] border-2 border-[var(--ink)] bg-[var(--paper)] p-4 shadow-[12px_12px_0_var(--ink)] sm:p-6">
            {landing.brand.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={landing.brand.coachDisplayName}
                className="aspect-[4/3] w-full object-cover"
                src={landing.brand.portraitUrl}
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-[var(--ink)] text-center text-white">
                <p className="display-type text-6xl">{initials(landing.brand.coachDisplayName)}</p>
              </div>
            )}
            <div className="mt-5 border-t border-[var(--line)] pt-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--signal-dark)]">
                {landing.brand.workspaceName}
              </p>
              <p className="display-type mt-1 text-3xl font-semibold">{landing.brand.coachDisplayName}</p>
            </div>
          </div>
        </div>
      </section>

      {landing.programs.length ? <Programs programs={landing.programs} /> : null}
      <Methodology methodology={landing.methodology} />
      {landing.results.length ? <Results results={landing.results} /> : null}
      <Contact landing={landing} />
      {landing.faq.length ? <Faq faq={landing.faq} /> : null}
    </main>
  );
}

function Programs({ programs }: { programs: PublicCoachLandingDto["programs"] }) {
  return (
    <section className="border-y-2 border-[var(--ink)] bg-[var(--ink)] px-5 py-10 text-[var(--paper)] sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
        {programs.map((program, index) => (
          <article className="border-l border-white/20 pl-5" key={program.title}>
            <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--signal-bright)]">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="display-type mt-3 text-3xl">{program.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">{program.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Methodology({ methodology }: { methodology: PublicCoachLandingDto["methodology"] }) {
  return (
    <section
      id="metodo"
      className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-12 lg:py-20"
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--signal-dark)]">Método</p>
        <h2 className="display-type mt-2 text-5xl leading-none font-semibold">Progreso con dirección.</h2>
      </div>
      <div className="grid gap-4">
        {methodology.map((step) => (
          <article className="rounded-[2rem] border border-[var(--line)] bg-white/70 p-5" key={step.title}>
            <h3 className="font-extrabold">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Results({ results }: { results: PublicCoachLandingDto["results"] }) {
  return (
    <section className="bg-[var(--paper)] px-5 py-14 sm:px-8 lg:px-12" aria-labelledby="results-title">
      <div className="mx-auto max-w-7xl">
        <h2 className="display-type text-5xl font-semibold" id="results-title">
          Resultados aprobados
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {results.map((result) => (
            <article className="rounded-[2rem] border border-[var(--line)] bg-white/70 p-5" key={result.publicId}>
              <h3 className="display-type text-3xl font-semibold">{result.headline}</h3>
              {result.narrative ? (
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{result.narrative}</p>
              ) : null}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.metrics.map((metric) => (
                  <div className="border-t border-[var(--line)] pt-3" key={metric.label}>
                    <dt className="text-xs font-extrabold uppercase text-[var(--ink-muted)]">{metric.label}</dt>
                    <dd className="font-bold">
                      {metric.before} → {metric.after} {metric.unit.toLowerCase()}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs font-bold text-[var(--ink-muted)]">{result.attributionLabel}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ landing }: { landing: PublicCoachLandingDto }) {
  return (
    <section
      id="contacto"
      className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_1fr] lg:px-12 lg:py-20"
    >
      {landing.about ? (
        <article>
          <h2 className="display-type text-5xl font-semibold">{landing.about.heading}</h2>
          <p className="mt-4 leading-8 text-[var(--ink-muted)]">{landing.about.body}</p>
        </article>
      ) : (
        <span />
      )}
      <article className="rounded-[2rem] border-2 border-[var(--ink)] bg-[var(--signal)] p-6 text-white shadow-[8px_8px_0_var(--ink)]">
        <h2 className="display-type text-4xl font-semibold">{landing.cta.heading}</h2>
        {landing.cta.body ? <p className="mt-3 leading-7 text-white/80">{landing.cta.body}</p> : null}
        <a
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-[var(--signal-dark)]"
          href={landing.cta.href}
        >
          Escribir por WhatsApp
        </a>
      </article>
    </section>
  );
}

function Faq({ faq }: { faq: PublicCoachLandingDto["faq"] }) {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8 lg:pb-24">
      {faq.map((item) => (
        <details className="border-t border-[var(--line)] py-4" key={item.question}>
          <summary className="cursor-pointer font-extrabold">{item.question}</summary>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CF"
  );
}
