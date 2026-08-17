import Link from "next/link";
import type { ComponentProps } from "react";

type ActionLinkProps = ComponentProps<typeof Link> & {
  tone?: "signal" | "ink" | "quiet";
};

const tones = {
  signal: "bg-[var(--signal)] text-white hover:bg-[var(--signal-dark)]",
  ink: "bg-[var(--ink)] text-white hover:bg-[#26364d]",
  quiet: "border border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink)]",
};

export function ActionLink({ className = "", tone = "signal", ...props }: ActionLinkProps) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--signal)] ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
