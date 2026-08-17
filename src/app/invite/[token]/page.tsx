import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvitationAction } from "@/app/actions/invitations";
import { auth } from "@/modules/identity/infrastructure/auth";

export const runtime = "nodejs";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/sign-in?callbackURL=${encodeURIComponent(`/invite/${token}`)}`);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-md border border-[var(--line)] bg-[var(--paper-light)] p-8 text-center">
        <h1 className="display-type text-4xl font-semibold">Sumate al workspace</h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">Confirmá para asociar tu cuenta a este equipo.</p>
        <form action={acceptInvitationAction.bind(null, token)}>
          <button className="mt-7 min-h-11 rounded-full bg-[var(--signal)] px-6 text-sm font-bold text-white" type="submit">Aceptar invitación</button>
        </form>
      </section>
    </main>
  );
}
