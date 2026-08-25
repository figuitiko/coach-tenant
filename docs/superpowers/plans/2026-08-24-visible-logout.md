# Visible Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible, accessible `Cerrar sesión` action to every authenticated desktop and mobile workspace navigation, ending the Better Auth session and returning the user to `/sign-in`.

**Architecture:** Keep role and workspace authorization in the existing server-rendered shell and route components. Add one reusable client component that owns the Better Auth call and transient interaction state, then render it from both existing navigation presentations with only a visual variant prop.

**Tech Stack:** Next.js App Router, React 19 client components, Better Auth 1.6, TypeScript, Tailwind CSS 4, Vitest, Testing Library, Playwright.

---

## File map

- Create `src/components/auth/sign-out-action.tsx`: client-only Better Auth boundary, duplicate-request lock, pending state, redirect, refresh, and non-leaky inline error.
- Create `src/components/auth/sign-out-action.test.tsx`: isolated interaction tests with injected sign-out behavior and mocked App Router.
- Create `src/components/shell/workspace-navigation.test.tsx`: coverage for coach/student top-bar and mobile functional-route navigation.
- Modify `src/components/shell/workspace-navigation.tsx`: append logout and reserve one mobile grid column for it.
- Modify `src/components/shell/workspace-shell.tsx`: append logout to dashboard sidebar/mobile navigation and reserve one mobile grid column.
- Modify `src/components/shell/workspace-shell.test.tsx`: cover ordinary coach, student, and explicit super-admin dashboard contexts.
- Modify `e2e/pilot-journeys.spec.ts`: database-backed desktop logout journey from functional navigation.
- Modify `e2e/pilot-mobile.spec.ts`: Pixel 7 logout journey from mobile navigation.

### Task 1: Build the reusable sign-out interaction with strict TDD

**Files:**
- Create: `src/components/auth/sign-out-action.test.tsx`
- Create: `src/components/auth/sign-out-action.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/auth/sign-out-action.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutAction, type SignOut } from "./sign-out-action";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("SignOutAction", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
  });

  it("locks duplicate requests, exposes pending state, and redirects after success", async () => {
    let finish!: () => void;
    const signOut = vi.fn<SignOut>(() => new Promise((resolve) => {
      finish = () => resolve({ error: null });
    }));
    const user = userEvent.setup();
    render(<SignOutAction signOut={signOut} variant="topbar" />);

    const idle = screen.getByRole("button", { name: "Cerrar sesión" });
    await user.click(idle);

    const pending = screen.getByRole("button", { name: "Cerrando sesión…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending).toHaveAttribute("aria-busy", "true");
    await user.click(pending);
    expect(signOut).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(replace).toHaveBeenCalledWith("/sign-in");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["error response", async () => ({ error: { message: "Internal database detail" } })],
    ["rejected request", async () => { throw new Error("Network detail"); }],
  ])("retains the current route and announces a non-leaky error for a %s", async (_case, signOut) => {
    const user = userEvent.setup();
    render(<SignOutAction signOut={signOut} variant="mobile" />);

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cerrar tu sesión. Intentá de nuevo.");
    expect(alert).toHaveClass("col-span-full");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/database detail|network detail/i)).not.toBeInTheDocument();
  });

  it("clears an earlier error before retrying", async () => {
    let attempt = 0;
    let finishRetry!: () => void;
    const signOut: SignOut = () => {
      attempt += 1;
      if (attempt === 1) return Promise.resolve({ error: { message: "failed" } });
      return new Promise((resolve) => {
        finishRetry = () => resolve({ error: null });
      });
    };
    const user = userEvent.setup();
    render(<SignOutAction signOut={signOut} variant="sidebar" />);

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    finishRetry();
    expect(await screen.findByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
pnpm vitest run src/components/auth/sign-out-action.test.tsx
```

Expected: FAIL because `./sign-out-action` does not exist. Record this expected failure before writing production code.

- [ ] **Step 3: Add the minimal client component**

Create `src/components/auth/sign-out-action.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the focused test and observe GREEN**

Run:

```bash
pnpm vitest run src/components/auth/sign-out-action.test.tsx
```

Expected: PASS with 4 cases. The public `SignOut` dependency remains structural so shell components never import auth-client types.

- [ ] **Step 5: Commit the isolated behavior**

```bash
git add src/components/auth/sign-out-action.tsx src/components/auth/sign-out-action.test.tsx
git commit -m "feat: add accessible sign-out action"
```

### Task 2: Integrate logout into functional-route navigation

**Files:**
- Create: `src/components/shell/workspace-navigation.test.tsx`
- Modify: `src/components/shell/workspace-navigation.tsx`

- [ ] **Step 1: Write the failing coach/student navigation contract**

Create `src/components/shell/workspace-navigation.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceNavigation } from "./workspace-navigation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("WorkspaceNavigation", () => {
  it.each([
    ["COACH", 4],
    ["STUDENT", 3],
  ] as const)("places logout last in desktop and mobile navigation for %s", (role, linkCount) => {
    render(<WorkspaceNavigation role={role} workspaceSlug="fuerza-norte" />);

    for (const navigation of screen.getAllByRole("navigation")) {
      expect(within(navigation).getAllByRole("link")).toHaveLength(linkCount);
      const logout = within(navigation).getByRole("button", { name: "Cerrar sesión" });
      expect(navigation.lastElementChild).toBe(logout);
    }

    const mobile = screen.getByRole("navigation", { name: /navegación móvil del workspace/i });
    expect(mobile).toHaveStyle({ gridTemplateColumns: `repeat(${linkCount + 1}, minmax(0, 1fr))` });
  });
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
pnpm vitest run src/components/shell/workspace-navigation.test.tsx
```

Expected: FAIL because neither navigation contains a `Cerrar sesión` button and the mobile grid still counts links only.

- [ ] **Step 3: Append the reusable action without changing authorized links**

Modify `src/components/shell/workspace-navigation.tsx` to import the action, append it after each `items.map`, and count the action in the mobile grid:

```tsx
import Link from "next/link";
import { SignOutAction } from "@/components/auth/sign-out-action";

export function WorkspaceNavigation({ workspaceSlug, role }: { workspaceSlug: string; role: "COACH" | "STUDENT" }) {
  const root = `/w/${workspaceSlug}`;
  const items = role === "COACH"
    ? [[root, "Inicio"], [`${root}/students`, "Alumnos"], [`${root}/training`, "Entrenamiento"], [`${root}/progress`, "Revisiones"]]
    : [[root, "Inicio"], [`${root}/training`, "Entrenamiento"], [`${root}/progress`, "Progreso"]];

  return <>
    <nav aria-label="Navegación del workspace" className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-[var(--paper)]/95 px-5 py-3 backdrop-blur lg:flex lg:justify-center lg:gap-2">
      {items.map(([href, label]) => <Link className="min-h-11 rounded-full px-4 py-3 text-sm font-extrabold text-[var(--ink-muted)] hover:bg-white hover:text-[var(--ink)]" href={href} key={href}>{label}</Link>)}
      <SignOutAction variant="topbar" />
    </nav>
    <nav aria-label="Navegación móvil del workspace" className="fixed inset-x-0 bottom-0 z-50 grid border-t border-white/15 bg-[var(--ink)] px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 text-white lg:hidden" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
      {items.map(([href, label]) => <Link className="flex min-h-12 items-center justify-center rounded-lg px-1 text-center text-[.7rem] font-bold" href={href} key={href}>{label}</Link>)}
      <SignOutAction variant="mobile" />
    </nav>
  </>;
}
```

- [ ] **Step 4: Run both focused navigation suites and observe GREEN**

Run:

```bash
pnpm vitest run src/components/shell/workspace-navigation.test.tsx src/components/auth/sign-out-action.test.tsx
```

Expected: PASS. The coach keeps 4 authorized links, the student keeps 3, and each navigation adds exactly one button after them.

- [ ] **Step 5: Commit the functional navigation integration**

```bash
git add src/components/shell/workspace-navigation.tsx src/components/shell/workspace-navigation.test.tsx
git commit -m "feat: expose logout on workspace routes"
```

### Task 3: Integrate logout into coach, student, and super-admin dashboard shells

**Files:**
- Modify: `src/components/shell/workspace-shell.test.tsx`
- Modify: `src/components/shell/workspace-shell.tsx`

- [ ] **Step 1: Add failing dashboard role coverage**

In `src/components/shell/workspace-shell.test.tsx`, change the Vitest import to include `vi`, add the App Router mock after imports, and add this test:

```tsx
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

it.each([
  ["ordinary coach", {
    workspaceId: "w-coach",
    workspaceSlug: "north",
    workspaceName: "North",
    timeZone: "America/Mexico_City",
    role: "COACH" as const,
    accessMode: "MEMBERSHIP" as const,
  }, 4],
  ["student", {
    workspaceId: "w-student",
    workspaceSlug: "north",
    workspaceName: "North",
    timeZone: "America/Mexico_City",
    role: "STUDENT" as const,
    accessMode: "MEMBERSHIP" as const,
  }, 3],
  ["super admin", defaultAdminMembership, 4],
] as const)("places logout last in desktop and mobile dashboard navigation for %s", (_label, membership, linkCount) => {
  render(<WorkspaceShell currentMembership={membership} memberships={[membership]} />);

  for (const navigation of screen.getAllByRole("navigation")) {
    expect(within(navigation).getAllByRole("link")).toHaveLength(linkCount);
    const logout = within(navigation).getByRole("button", { name: "Cerrar sesión" });
    expect(navigation.lastElementChild).toBe(logout);
  }

  const mobile = screen.getByRole("navigation", { name: /navegación móvil/i });
  expect(mobile).toHaveStyle({ gridTemplateColumns: `repeat(${linkCount + 1}, minmax(0, 1fr))` });
});
```

Keep the existing tests unchanged, including the explicit super-admin panel label and the authorized link counts.

- [ ] **Step 2: Run the shell test and observe RED**

Run:

```bash
pnpm vitest run src/components/shell/workspace-shell.test.tsx
```

Expected: FAIL because dashboard navigation has no logout button and its mobile grid has no action column.

- [ ] **Step 3: Append logout in the shared dashboard `Navigation` helper**

In `src/components/shell/workspace-shell.tsx`, add:

```tsx
import { SignOutAction } from "@/components/auth/sign-out-action";
```

Replace only the private `Navigation` helper with:

```tsx
function Navigation({ items, mobile }: { items: Array<{ href: string; label: string }>; mobile: boolean }) {
  return <nav aria-label={mobile ? "Navegación móvil" : "Navegación principal"} className={mobile ? "fixed inset-x-0 bottom-0 z-50 grid border-t border-white/15 bg-[var(--ink)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-white shadow-[0_-10px_30px_rgba(16,27,43,0.18)] lg:hidden" : "mt-12 space-y-2 text-sm font-bold"} style={mobile ? { gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` } : undefined}>
    {items.map((item, index) => <a aria-current={index === 0 ? "page" : undefined} className={mobile ? `flex min-h-12 items-center justify-center rounded-lg px-1 text-center text-[0.7rem] font-bold ${index === 0 ? "bg-white/10 text-[var(--signal-bright)]" : "text-white"}` : index === 0 ? "block border-l-4 border-[var(--signal)] bg-white/60 px-4 py-3" : "block px-5 py-3 text-[var(--ink-muted)]"} href={item.href} key={item.href}>{item.label}</a>)}
    <SignOutAction variant={mobile ? "mobile" : "sidebar"} />
  </nav>;
}
```

- [ ] **Step 4: Run all component suites for the feature and observe GREEN**

Run:

```bash
pnpm vitest run src/components/auth/sign-out-action.test.tsx src/components/shell/workspace-navigation.test.tsx src/components/shell/workspace-shell.test.tsx
```

Expected: PASS. `SUPER_ADMIN`, `COACH`, and `STUDENT` dashboard contexts have logout on desktop and mobile, while functional routes remain covered for both membership roles.

- [ ] **Step 5: Commit the dashboard integration**

```bash
git add src/components/shell/workspace-shell.tsx src/components/shell/workspace-shell.test.tsx
git commit -m "feat: expose logout on workspace dashboard"
```

### Task 4: Cover real desktop and Pixel 7 logout journeys

**Files:**
- Modify: `e2e/pilot-journeys.spec.ts`
- Modify: `e2e/pilot-mobile.spec.ts`

- [ ] **Step 1: Add the failing desktop authenticated journey**

Append inside the existing `test.describe("pilot PostgreSQL journeys", () => {` block in `e2e/pilot-journeys.spec.ts`:

```ts
test("coach signs out from functional desktop navigation", async ({ page }) => {
  await signIn(page, "coach.fuerzanorte@tenand.local");
  await page.goto("/w/fuerza-norte-pilot/training");
  const navigation = page.getByRole("navigation", { name: "Navegación del workspace" });

  await expect(navigation.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await navigation.getByRole("button", { name: "Cerrar sesión" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/w/fuerza-norte-pilot/training");
  await expect(page).toHaveURL(/\/sign-in$/);
});
```

- [ ] **Step 2: Extend the Pixel 7 journey with visible logout**

In `e2e/pilot-mobile.spec.ts`, after the coach navigation assertions and before `coachContext.close()`, add:

```ts
await expect(coachNavigation.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
await coachNavigation.getByRole("button", { name: "Cerrar sesión" }).click();
await expect(coach).toHaveURL(/\/sign-in$/);
await coach.goto("/w/fuerza-norte-pilot");
await expect(coach).toHaveURL(/\/sign-in$/);
```

After the student check-in assertion and before `studentContext.close()`, add:

```ts
const progressNavigation = student.getByRole("navigation", { name: /navegación móvil del workspace/i });
await expect(progressNavigation.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
await progressNavigation.getByRole("button", { name: "Cerrar sesión" }).click();
await expect(student).toHaveURL(/\/sign-in$/);
```

- [ ] **Step 3: Verify E2E discovery before running a server**

Run:

```bash
pnpm exec playwright test --list
```

Expected: exit 0; output lists `coach signs out from functional desktop navigation` under `pilot-postgres` and the existing authenticated mobile journey under `pilot-mobile-postgres`. No production build is run.

- [ ] **Step 4: Run the mandatory database-backed authenticated suite**

Run:

```bash
TEST_DATABASE_URL="$TEST_DATABASE_URL" PILOT_SEED_PASSWORD="$PILOT_SEED_PASSWORD" pnpm test:e2e:pilot
```

Expected with both variables configured: migrations and deterministic seed succeed, then the `pilot-postgres` and Pixel 7 `pilot-mobile-postgres` projects pass using `next dev`. Expected without `TEST_DATABASE_URL`: exit 1 with `TEST_DATABASE_URL is required for the mandatory pilot E2E suite.`; report that fail-closed gate rather than bypassing it.

- [ ] **Step 5: Commit the authenticated journeys**

```bash
git add e2e/pilot-journeys.spec.ts e2e/pilot-mobile.spec.ts
git commit -m "test: cover authenticated logout journeys"
```

### Task 5: Run complete verification without building

**Files:**
- Verify only; do not modify `AGENTS.md` or generated Prisma files.

- [ ] **Step 1: Run the complete unit/component suite**

```bash
pnpm test
```

Expected: exit 0 with every Vitest file and test passing, including the new sign-out and both navigation suites.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: exit 0 with no ESLint errors.

- [ ] **Step 3: Run TypeScript validation**

```bash
pnpm typecheck
```

Expected: exit 0 with no TypeScript errors, including structural compatibility between `SignOut` and `authClient.signOut()`.

- [ ] **Step 4: Run public desktop/mobile smoke using `next dev`**

```bash
pnpm test:e2e:public
```

Expected: exit 0 for `chromium` and `mobile-chrome`. This command uses the Playwright `webServer` configured with `pnpm dev`; never run `pnpm build`.

- [ ] **Step 5: Check the intended diff and repository hygiene**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Only intended logout files may be staged or committed; the pre-existing modified `AGENTS.md` and generated Prisma files remain uncommitted and must not be restored, staged, or changed.
