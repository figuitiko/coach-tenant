import { UnknownLandingThemeError } from "./errors";
export const LANDING_THEMES = ["editorial"] as const;
export type LandingThemeKey = (typeof LANDING_THEMES)[number];
export type LandingThemeRenderer = { key: LandingThemeKey };
const renderers: Record<LandingThemeKey, LandingThemeRenderer> = { editorial: { key: "editorial" } };
export function resolveLandingTheme(theme: string): LandingThemeRenderer {
  if (!(LANDING_THEMES as readonly string[]).includes(theme)) throw new UnknownLandingThemeError(theme);
  return renderers[theme as LandingThemeKey];
}
