"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/modules/identity/infrastructure/auth-client";

export type SignOut = () => Promise<{
  error?: { message?: string } | null;
}>;

type SignOutVariant = "sidebar" | "topbar" | "mobile";

const buttonClass: Record<SignOutVariant, string> = {
  sidebar: "block min-h-11 w-full px-5 py-3 text-left text-sm font-bold text-[var(--ink-muted)] hover:bg-white/60 hover:text-[var(--ink)] disabled:cursor-wait disabled:opacity-70",
  topbar: "min-h-11 rounded-full px-4 py-3 text-sm font-extrabold text-[var(--ink-muted)] hover:bg-white hover:text-[var(--ink)] disabled:cursor-wait disabled:opacity-70",
  mobile: "flex min-h-12 min-w-0 items-center justify-center rounded-lg px-1 text-center text-[.7rem] font-bold text-white disabled:cursor-wait disabled:opacity-70",
};

const errorClass: Record<SignOutVariant, string> = {
  sidebar: "px-5 pt-1 text-xs font-bold text-[var(--signal-dark)]",
  topbar: "self-center px-2 text-xs font-bold text-[var(--signal-dark)]",
  mobile: "col-span-full px-2 pb-1 text-center text-[.7rem] font-bold text-red-100",
};

export function SignOutAction({
  variant,
  signOut = () => authClient.signOut(),
}: {
  variant: SignOutVariant;
  signOut?: SignOut;
}) {
  const router = useRouter();
  const requestPending = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function runSignOut() {
    if (requestPending.current) return;
    requestPending.current = true;
    setPending(true);
    setFailed(false);
    try {
      const result = await signOut();
      if (result.error) {
        setFailed(true);
        return;
      }
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      requestPending.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        aria-busy={pending}
        aria-disabled={pending}
        className={buttonClass[variant]}
        disabled={pending}
        onClick={runSignOut}
        type="button"
      >
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {failed ? <p className={errorClass[variant]} role="alert">No pudimos cerrar tu sesión. Intentá de nuevo.</p> : null}
    </>
  );
}
