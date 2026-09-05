import { createHash } from "node:crypto";
import { MarketingValidationError } from "./errors";
import { resolveLandingTheme, type LandingThemeKey } from "./theme";

export type AttributionMode = "ANONYMOUS" | "FIRST_NAME_INITIAL" | "FULL_NAME";
export type PublicMetricUnit = "KG" | "LB" | "CM" | "IN" | "PERCENT";
export type LandingItem = { title: string; description: string };
export type MetricInput = { label: string; beforeValue: number; afterValue: number; unit: PublicMetricUnit; order: number };
export type ResultVersionInput = {
  headline: string; narrative?: string | null; testimonial?: string | null;
  attributionMode?: AttributionMode; attributionLabel?: string | null; metrics: MetricInput[];
};
export type LandingContentInput = {
  themeKey?: string; coachDisplayName: string; heroEyebrow?: string | null; heroHeadline: string; heroSubheadline: string;
  valueProposition?: string | null; servicesHeading?: string | null; services?: LandingItem[];
  methodologyHeading?: string | null; methodology?: LandingItem[]; resultsHeading?: string | null;
  aboutHeading?: string | null; aboutBody?: string | null; faqHeading?: string | null;
  faqs?: Array<{ question: string; answer: string }>;
  ctaHeading: string; ctaBody?: string | null; whatsappDigits: string; whatsappMessage: string;
  instagramUrl?: string | null; publicEmail?: string | null; seoTitle?: string | null; seoDescription?: string | null;
  resultAttributionMode?: AttributionMode; resultAttributionLabel?: string | null;
};

const LIMITS = { display: 100, headline: 160, summary: 320, body: 2000, item: 160, message: 500, collection: 10 } as const;
const text = (value: string | null | undefined, max: number, required = false): string | null => {
  const normalized = value == null ? "" : value.normalize("NFC").replace(/\s+/g, " ").trim();
  if (required && !normalized) throw new MarketingValidationError("Required field is blank");
  if (normalized.length > max) throw new MarketingValidationError("Text is too long");
  // Do not accept markup-capable content. Rendering must remain plain text.
  if (/<[^>]*>|```|\[[^\]]+\]\([^)]*\)|(^|\s)#{1,6}\s/.test(normalized)) throw new MarketingValidationError("Markup is not allowed");
  return normalized || null;
};
function collection<T>(items: T[] | undefined, map: (item: T) => T): T[] {
  if (!items) return [];
  if (!Array.isArray(items) || items.length > LIMITS.collection) throw new MarketingValidationError("Too many items");
  return items.map(map);
}
export function normalizeWhatsAppDigits(value: string): string {
  if (/[^0-9+()\s.-]/.test(value)) throw new MarketingValidationError("Invalid WhatsApp number", { whatsappDigits: "Use only an international number" });
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15 || /[^0-9]/.test(digits)) throw new MarketingValidationError("Invalid WhatsApp number", { whatsappDigits: "Use 8–15 international digits" });
  return digits;
}
function url(value: string | null | undefined, field: string): string | null {
  const normalized = text(value, 500);
  if (!normalized) return null;
  try { const parsed = new URL(normalized); if (parsed.protocol !== "https:") throw new Error(); return parsed.toString(); }
  catch { throw new MarketingValidationError(`Invalid ${field}`, { [field]: "Use an HTTPS URL" }); }
}
function email(value: string | null | undefined): string | null {
  const normalized = text(value, 254); if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new MarketingValidationError("Invalid email", { publicEmail: "Invalid email" });
  return normalized.toLowerCase();
}
function metric(metric: MetricInput): MetricInput {
  const label = text(metric.label, 80, true)!;
  if (!Number.isInteger(metric.order) || metric.order < 0 || !Number.isFinite(metric.beforeValue) || !Number.isFinite(metric.afterValue)) throw new MarketingValidationError("Invalid metric");
  if (Math.round(metric.beforeValue * 100) !== metric.beforeValue * 100 || Math.round(metric.afterValue * 100) !== metric.afterValue * 100) throw new MarketingValidationError("Metric precision exceeds 2 decimals");
  const ranges: Record<PublicMetricUnit, [number, number]> = { KG: [20, 500], LB: [44, 1100], CM: [1, 400], IN: [0.4, 160], PERCENT: [0, 100] };
  const range = ranges[metric.unit]; if (!range || metric.beforeValue < range[0] || metric.beforeValue > range[1] || metric.afterValue < range[0] || metric.afterValue > range[1]) throw new MarketingValidationError("Metric is out of range");
  return { label, beforeValue: metric.beforeValue, afterValue: metric.afterValue, unit: metric.unit, order: metric.order };
}
export function normalizeLandingContent(input: LandingContentInput): LandingContentInput & { themeKey: LandingThemeKey; resultAttributionMode: AttributionMode; whatsappDigits: string } {
  const themeKey = (input.themeKey ?? "editorial") as LandingThemeKey; resolveLandingTheme(themeKey);
  return {
    ...input, themeKey, coachDisplayName: text(input.coachDisplayName, LIMITS.display)!,
    heroEyebrow: text(input.heroEyebrow, LIMITS.item), heroHeadline: text(input.heroHeadline, LIMITS.headline)!, heroSubheadline: text(input.heroSubheadline, LIMITS.summary)!,
    valueProposition: text(input.valueProposition, LIMITS.body), servicesHeading: text(input.servicesHeading, LIMITS.item), methodologyHeading: text(input.methodologyHeading, LIMITS.item), resultsHeading: text(input.resultsHeading, LIMITS.item), aboutHeading: text(input.aboutHeading, LIMITS.item), aboutBody: text(input.aboutBody, LIMITS.body), faqHeading: text(input.faqHeading, LIMITS.item), ctaHeading: text(input.ctaHeading, LIMITS.item)!, ctaBody: text(input.ctaBody, LIMITS.body),
    services: collection(input.services, item => ({ title: text(item.title, LIMITS.item, true)!, description: text(item.description, LIMITS.body, true)! })),
    methodology: collection(input.methodology, item => ({ title: text(item.title, LIMITS.item, true)!, description: text(item.description, LIMITS.body, true)! })),
    faqs: collection(input.faqs, item => ({ question: text(item.question, LIMITS.item, true)!, answer: text(item.answer, LIMITS.body, true)! })),
    whatsappDigits: input.whatsappDigits.trim() ? normalizeWhatsAppDigits(input.whatsappDigits) : "", whatsappMessage: text(input.whatsappMessage, LIMITS.message, true)!, instagramUrl: url(input.instagramUrl, "instagramUrl"), publicEmail: email(input.publicEmail), seoTitle: text(input.seoTitle, LIMITS.headline), seoDescription: text(input.seoDescription, LIMITS.summary), resultAttributionMode: input.resultAttributionMode ?? "ANONYMOUS", resultAttributionLabel: text(input.resultAttributionLabel, LIMITS.display),
  };
}
export function validateDraft(input: LandingContentInput): LandingContentInput & { themeKey: LandingThemeKey; resultAttributionMode: AttributionMode; whatsappDigits: string } { return normalizeLandingContent(input); }
export function validatePublication(input: LandingContentInput) {
  const normalized = normalizeLandingContent(input);
  if (!normalized.coachDisplayName || !normalized.heroHeadline || !normalized.heroSubheadline || !normalized.ctaHeading || !normalized.whatsappDigits || !normalized.whatsappMessage) throw new MarketingValidationError("Landing is incomplete");
  return normalized;
}
export function buildWhatsAppUrl(digits: string, message: string): string { return `https://wa.me/${normalizeWhatsAppDigits(digits)}?text=${encodeURIComponent(text(message, LIMITS.message, true)!)}`; }
export function normalizeResultVersionInput(input: ResultVersionInput): ResultVersionInput {
  const mode = input.attributionMode ?? "ANONYMOUS";
  if (!["ANONYMOUS", "FIRST_NAME_INITIAL", "FULL_NAME"].includes(mode)) throw new MarketingValidationError("Invalid attribution mode");
  const attributionLabel = text(input.attributionLabel, LIMITS.display) ?? "";
  if (mode !== "ANONYMOUS" && !attributionLabel) throw new MarketingValidationError("Named attribution requires a label");
  const metrics = input.metrics.map(metric);
  if (new Set(metrics.map((item) => item.order)).size !== metrics.length) throw new MarketingValidationError("Metric order must be unique");
  return { headline: text(input.headline, LIMITS.headline, true)!, narrative: text(input.narrative, LIMITS.body), testimonial: text(input.testimonial, LIMITS.body), attributionMode: mode as AttributionMode, attributionLabel, metrics: metrics.sort((a, b) => a.order - b.order) };
}
export function validateResultVersion(input: ResultVersionInput): ResultVersionInput { return normalizeResultVersionInput(input); }

export function fingerprintResultVersion(input: ResultVersionInput): string {
  const normalized = normalizeResultVersionInput(input);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
