import { BrandMark } from "@/components/shell/brand-mark";
import { SignInForm } from "@/components/auth/sign-in-form";
import { InviteSignUpForm } from "@/components/auth/invite-sign-up-form";
import { invitationTokenFromCallback, safeRelativeCallback } from "@/modules/identity/application/auth-callback";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string | string[] }>;
}) {
  const rawCallback = (await searchParams).callbackURL;
  const callbackUrl = safeRelativeCallback(
    typeof rawCallback === "string" ? rawCallback : null,
    "/workspace",
  );
  const invitationToken = invitationTokenFromCallback(callbackUrl);

  return (
    <main className="paper-grain grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
      <section className="flex flex-col justify-between bg-[var(--ink)] p-6 text-white sm:p-10 lg:p-14">
        <BrandMark />
        <blockquote className="display-type my-20 max-w-lg text-4xl leading-tight sm:text-6xl">
          “La constancia aparece cuando el próximo paso está claro.”
        </blockquote>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Entrená el proceso</p>
      </section>
      <section className="flex items-center px-5 py-14 sm:px-12 lg:px-20">
        <div className="w-full max-w-md">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--signal)]">Acceso de equipo</p>
          <h1 className="display-type mt-3 text-5xl font-semibold tracking-tight">Volvé al trabajo.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Ingresá con las credenciales de tu workspace.</p>
          <SignInForm callbackUrl={callbackUrl} />
          {invitationToken && <InviteSignUpForm callbackUrl={callbackUrl} />}
          <p className="mt-6 text-center text-xs text-[var(--ink-muted)]">¿Recibiste una invitación? Abrí el enlace que te envió tu coach.</p>
        </div>
      </section>
    </main>
  );
}
