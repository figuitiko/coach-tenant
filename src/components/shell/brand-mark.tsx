import Link from "next/link";

export function BrandMark() {
  return (
    <Link className="inline-flex items-center gap-2 font-extrabold tracking-[-0.04em]" href="/">
      <span
        className="grid size-8 place-items-center rounded-full bg-[var(--ink)] text-sm text-white"
        aria-hidden="true"
      >
        C
      </span>
      CoachFlow
    </Link>
  );
}
