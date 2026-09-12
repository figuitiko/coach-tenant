import {
  buildWhatsAppUrl,
  normalizeResultVersionInput,
  type PublicMetricUnit,
  type ResultVersionInput,
} from "./contracts";
import { resolveLandingTheme, type LandingThemeKey } from "./theme";

export type PublicLandingMetricDto = { label: string; before: string; after: string; unit: PublicMetricUnit };
export type PublicLandingResultDto = {
  publicId: string;
  headline: string;
  narrative: string | null;
  testimonial: string | null;
  attributionLabel: string;
  metrics: PublicLandingMetricDto[];
};
export type PublicCoachLandingDto = {
  workspaceSlug: string;
  revisionId: string;
  themeKey: LandingThemeKey;
  brand: {
    workspaceName: string;
    coachDisplayName: string;
    logoUrl: string | null;
    portraitUrl: string | null;
  };
  hero: { eyebrow: string | null; headline: string; subheadline: string };
  credibility: Array<{ label: string; value: string }>;
  programs: Array<{ title: string; description: string }>;
  methodology: Array<{ title: string; description: string }>;
  results: PublicLandingResultDto[];
  about: { heading: string; body: string } | null;
  faq: Array<{ question: string; answer: string }>;
  cta: { heading: string; body: string | null; href: string };
  seo: { title: string; description: string; canonicalUrl: string };
};

type Source = Record<string, unknown>;

type PublicResultSource = {
  publicId: string;
  headline: string;
  narrative?: string | null;
  testimonial?: string | null;
  attributionMode?: ResultVersionInput["attributionMode"];
  attributionLabel: string;
  metrics?: Array<{ label: string; beforeValue: unknown; afterValue: unknown; unit: PublicMetricUnit; order?: number }>;
};

export function toPublicCoachLandingDto(source: Source): PublicCoachLandingDto {
  if (source.results !== undefined && !Array.isArray(source.results)) throw new Error("Malformed public results");
  const workspaceSlug = String(source.workspaceSlug ?? "");
  const revisionId = String(source.revisionId ?? "");
  const themeKey = resolveLandingTheme(String(source.themeKey ?? "")).key;
  const coachDisplayName = String(source.coachDisplayName ?? "");
  const heroHeadline = String(source.heroHeadline ?? "");
  const heroSubheadline = String(source.heroSubheadline ?? "");
  const whatsappDigits = String(source.whatsappDigits ?? "");
  const whatsappMessage = String(source.whatsappMessage ?? "");
  const results = Array.isArray(source.results) ? source.results.map(toPublicResultDto) : [];

  return {
    workspaceSlug,
    revisionId,
    themeKey,
    brand: {
      workspaceName: String(source.workspaceName ?? ""),
      coachDisplayName,
      logoUrl: mediaProxyUrl(workspaceSlug, source.logoAssetId) ?? (source.logoUrl as string | null) ?? null,
      portraitUrl:
        mediaProxyUrl(workspaceSlug, source.portraitAssetId) ?? (source.portraitUrl as string | null) ?? null,
    },
    hero: {
      eyebrow: (source.heroEyebrow as string | null) ?? null,
      headline: heroHeadline,
      subheadline: heroSubheadline,
    },
    credibility: Array.isArray(source.credibility)
      ? source.credibility.map((item) => ({
          label: String((item as Source).label),
          value: String((item as Source).value),
        }))
      : [],
    programs: Array.isArray(source.services)
      ? source.services.map((item) => ({
          title: String((item as Source).title),
          description: String((item as Source).description),
        }))
      : [],
    methodology: Array.isArray(source.methodology)
      ? source.methodology.map((item) => ({
          title: String((item as Source).title),
          description: String((item as Source).description),
        }))
      : [],
    results,
    about:
      source.aboutHeading || source.aboutBody
        ? { heading: String(source.aboutHeading ?? ""), body: String(source.aboutBody ?? "") }
        : null,
    faq: Array.isArray(source.faqs)
      ? source.faqs.map((item) => ({
          question: String((item as Source).question),
          answer: String((item as Source).answer),
        }))
      : [],
    cta: {
      heading: String(source.ctaHeading ?? ""),
      body: (source.ctaBody as string | null) ?? null,
      href: workspaceSlug ? `/c/${workspaceSlug}/go/whatsapp` : buildWhatsAppUrl(whatsappDigits, whatsappMessage),
    },
    seo: {
      title: String(source.seoTitle ?? (coachDisplayName || heroHeadline)),
      description: String(source.seoDescription ?? heroSubheadline),
      canonicalUrl: workspaceSlug ? `/c/${workspaceSlug}` : "",
    },
  };
}

function toPublicResultDto(result: unknown): PublicLandingResultDto {
  const source = result as PublicResultSource;
  const normalized = normalizeResultVersionInput({
    headline: source.headline,
    narrative: source.narrative ?? null,
    testimonial: source.testimonial ?? null,
    attributionMode: source.attributionMode,
    attributionLabel: source.attributionLabel,
    metrics: Array.isArray(source.metrics)
      ? source.metrics.map((metric) => ({
          label: metric.label,
          beforeValue: Number(metric.beforeValue),
          afterValue: Number(metric.afterValue),
          unit: metric.unit,
          order: Number(metric.order ?? 0),
        }))
      : [],
  });
  return {
    publicId: source.publicId,
    headline: normalized.headline,
    narrative: normalized.narrative ?? null,
    testimonial: normalized.testimonial ?? null,
    attributionLabel: normalized.attributionLabel ?? "Anónimo",
    metrics: normalized.metrics.map(({ label, beforeValue, afterValue, unit }) => ({
      label,
      before: beforeValue.toFixed(2),
      after: afterValue.toFixed(2),
      unit,
    })),
  };
}

function mediaProxyUrl(workspaceSlug: string, assetId: unknown): string | null {
  if (!workspaceSlug || typeof assetId !== "string" || !assetId) return null;
  return `/c/${workspaceSlug}/media/${assetId}`;
}
