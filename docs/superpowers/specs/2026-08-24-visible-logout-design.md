# Visible Logout Design

## Goal

Give every authenticated user a clear, reliable way to end their session from the shared workspace navigation. `Cerrar sesión` appears after the role-specific navigation items for `SUPER_ADMIN`, `COACH`, and `STUDENT`, on desktop and mobile.

## Scope

This change adds only the logout interaction and its tests. It does not change authentication providers, session lifetime, workspace authorization, navigation destinations, or visual language.

## Architecture and component boundary

- Keep workspace access and role resolution server-side. Existing server components continue to decide which workspace navigation is rendered.
- Add a small client component, `SignOutAction`, as the only boundary that imports and calls `authClient.signOut()` from Better Auth.
- Render that action at the end of both shared navigation presentations: the workspace dashboard shell and the navigation used by functional workspace routes. This keeps logout reachable from every authenticated workspace screen while avoiding auth behavior duplicated inside presentation components.
- The action accepts presentation context, such as desktop or mobile, only to reuse the surrounding navigation styles. It does not receive a user, workspace, role, token, or redirect URL.
- Preserve the current role-specific links and ordering. Logout is an action, not a navigation link, and is visually separated or positioned last without introducing a new component language.

## Data flow

1. The user activates `Cerrar sesión`.
2. `SignOutAction` sets a local pending state immediately and disables the control, preventing duplicate requests.
3. The component calls Better Auth through `authClient.signOut()` with the current session cookie; no session identifiers are exposed to the UI.
4. A resolved Better Auth response with no error is success. Client navigation replaces the current history entry with `/sign-in`, followed by a router refresh so authenticated server-rendered state cannot remain visible.
5. A Better Auth error response or rejected request is failure. The user stays on the current page with the existing session intact, the control becomes available again, and an inline error invites a retry.

## Interaction, accessibility, and errors

- The idle label is `Cerrar sesión`; while pending it changes to `Cerrando sesión…`.
- The pending control is disabled and exposes `aria-disabled` and `aria-busy` so pointer, keyboard, and assistive-technology users receive consistent feedback.
- The action remains a semantic `button`, is keyboard operable, and retains the existing minimum touch target in mobile navigation.
- Failure copy is calm and actionable: `No pudimos cerrar tu sesión. Intentá de nuevo.` It is rendered next to the action with `role="alert"` so it is announced without moving focus away from the retry control.
- A failure must not redirect, clear local UI optimistically, or imply that the session ended. A later retry clears the previous error before starting.
- Desktop placement is after the final navigation item in the shared navigation area. Mobile placement is the final item in the bottom navigation and must remain readable without shrinking below the established touch target; when present, its error spans a separate full-width row rather than compressing the navigation items.

## Strict-TDD expectations

Implementation starts with failing tests and proceeds in the following order:

1. Component tests prove `SignOutAction` calls Better Auth once, becomes disabled/busy with pending copy, and ignores duplicate activation while the request is unresolved.
2. Component tests prove success replaces the route with `/sign-in` and refreshes navigation state.
3. Component tests prove failure retains the current route, restores the enabled action, and announces the inline retry message.
4. Navigation tests prove the action is last and visible in desktop and mobile presentations for `SUPER_ADMIN`, `COACH`, and `STUDENT`, without changing their authorized links.
5. The authenticated Playwright project covers desktop and mobile logout, landing on `/sign-in`, and denial when revisiting an authenticated workspace route. This remains a fail-closed database-backed test under the project's existing authenticated E2E gate.

No production implementation is part of this design-only change. No build command is required or permitted.
